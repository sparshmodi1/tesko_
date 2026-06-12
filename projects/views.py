import json
import os
import re
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlparse
from urllib.request import Request, urlopen
from django.db.models import Q
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_GET, require_POST

from .forms import BacklogTaskForm, CreateTaskForm, CreateWorkspaceForm, EditTaskForm
from .models import GitHubRepositoryConnection, Workspace, createTask


GITHUB_REPO_RE = re.compile(r'^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')


class GitHubAPIError(Exception):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status


def normalize_github_repo(raw_repo):
    repo = (raw_repo or '').strip()
    if not repo:
        return ''

    repo = repo.removesuffix('.git').strip('/')
    if repo.startswith('git@github.com:'):
        repo = repo.split(':', 1)[1]
    elif 'github.com' in repo:
        parsed = urlparse(repo if '://' in repo else f'https://{repo}')
        repo = parsed.path.strip('/')

    repo = repo.removesuffix('.git').strip('/')
    parts = repo.split('/')
    if len(parts) < 2:
        return ''

    normalized = f'{parts[0]}/{parts[1]}'
    return normalized if GITHUB_REPO_RE.match(normalized) else ''


def github_token():
    return getattr(settings, 'GITHUB_TOKEN', None) or os.environ.get('GITHUB_TOKEN', '')


def github_headers():
    headers = {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Tesko-Django-App',
        'X-GitHub-Api-Version': '2022-11-28',
    }
    token = github_token()
    if token:
        headers['Authorization'] = f'Bearer {token}'
    return headers


def github_request(repo, endpoint='', params=None):
    clean_params = {key: value for key, value in (params or {}).items() if value not in (None, '')}
    url = f'https://api.github.com/repos/{repo}{endpoint}'
    if clean_params:
        url = f'{url}?{urlencode(clean_params)}'

    request = Request(url, headers=github_headers())

    try:
        with urlopen(request, timeout=12) as response:
            body = response.read().decode('utf-8')
            return json.loads(body) if body else {}
    except HTTPError as exc:
        body = exc.read().decode('utf-8', errors='replace')
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            payload = {}
        raise GitHubAPIError(payload.get('message') or f'GitHub returned {exc.code}.', exc.code)
    except URLError as exc:
        raise GitHubAPIError(f'Could not reach GitHub: {exc.reason}', 503)
    except TimeoutError:
        raise GitHubAPIError('GitHub request timed out.', 504)


def connected_github_repo(request):
    connection = GitHubRepositoryConnection.objects.filter(user=request.user).first()
    if connection:
        return connection.repo

    session_repo = normalize_github_repo(request.session.get('github_repo', ''))
    if session_repo:
        GitHubRepositoryConnection.objects.update_or_create(
            user=request.user,
            defaults={'repo': session_repo},
        )
        return session_repo

    return ''


def github_json_response(data, status=200):
    return JsonResponse(data, safe=not isinstance(data, list), status=status)


def github_proxy_response(request, endpoint='', params=None):
    repo = connected_github_repo(request)
    if not repo:
        return JsonResponse({'error': 'No GitHub repository is connected yet.'}, status=400)

    try:
        return github_json_response(github_request(repo, endpoint, params))
    except GitHubAPIError as exc:
        return JsonResponse({'error': str(exc)}, status=exc.status)


def int_param(request, name, default, maximum=100):
    try:
        value = int(request.GET.get(name, default))
    except (TypeError, ValueError):
        value = default
    return max(1, min(value, maximum))


@login_required
def home_view(request):
    return render(request, 'home.html')

@login_required
def roadmap_view(request):
    return render(request, 'roadmap.html')

@login_required
def landing_view(request):
    return render(request, 'landing.html')

@login_required
def backlog_view(request):

    workspace = None

    workspace_id = request.session.get('workspace_id')

    if workspace_id:
        workspace = Workspace.objects.filter(
            id=workspace_id,
            members=request.user
        ).first()

    if not workspace:
        workspace = Workspace.objects.filter(
            members=request.user
        ).first()

        if workspace:
            request.session['workspace_id'] = workspace.id

    if not workspace:
        return redirect('onboard')

    form = BacklogTaskForm(request.POST or None)

    if request.method == "POST" and form.is_valid():
        task = form.save(commit=False)

        # attach task to current workspace
        task.workspace = workspace

        task.save()

        return redirect('backlog')

    users = workspace.members.all()

    tasks = createTask.objects.filter(
        workspace=workspace
    ).select_related(
        'assignee'
    ).order_by('id')

    Workspaces = Workspace.objects.filter(
        members=request.user
    ).distinct()

    return render(request, 'backlog.html', {
        'form': form,
        'workspace': workspace,
        'Workspaces': Workspaces,
        'users': users,
        'backlog_tasks': tasks,
        'backlog_count': tasks.count(),
    })

@login_required
def code_view(request):
    return render(request, 'code.html', {
        'github_repo': connected_github_repo(request),
    })

@login_required
def project_pages(request):
    return render(request, 'project_pages.html')

@login_required
def project_settings(request):
    return render(request, 'settings.html')

@login_required
def members(request):
    users = User.objects.all()
    for user in users:
        user.total_tasks = createTask.objects.filter(assignee=user).count()
    
    return render(request, 'members.html', {'users': users})

@login_required
def time_tracking(request):
    return render(request, 'time_tracking.html')

@login_required
def profile(request):
    return render(request, 'profile.html')

@login_required
def board_view(request):
    workspace_id = request.session.get('workspace_id')
    workspace = None

    if workspace_id:
        workspace = Workspace.objects.filter(
            id=workspace_id,
            members=request.user
        ).first()

    if not workspace:
        workspace = Workspace.objects.filter(
            members=request.user
        ).first()
        if workspace:
            request.session['workspace_id'] = workspace.id

    if not workspace:
        return redirect('onboard')

    create_form = CreateTaskForm(
        request.POST or None,
        workspace=workspace
    )

    if request.method == "POST" and request.POST.get('form_type') == 'create_task' and create_form.is_valid():
        task = create_form.save(commit=False)
        task.workspace = workspace  
        task.save()
        return redirect('home')

    users = workspace.members.all()
    tasks = createTask.objects.filter(workspace=workspace)
    Workspaces = Workspace.objects.filter(members=request.user).distinct()

    return render(request, 'home.html', {
        'workspace': workspace,
        'Workspaces': Workspaces,
        'create_form': create_form,
        'edit_form': EditTaskForm(),
        'users': users,
        'todo_tasks': tasks.filter(status='todo'),
        'in_progress_tasks': tasks.filter(status='in_progress'),
        'done_tasks': tasks.filter(status='done'),
        'in_review_tasks': tasks.filter(status='in_review'),
        'total_tasks': tasks,
        'todo_count': tasks.filter(status='todo').count(),
        'in_progress_count': tasks.filter(status='in_progress').count(),
        'done_count': tasks.filter(status='done').count(),
        'in_review_count': tasks.filter(status='in_review').count(),
    })

@login_required
def switch_workspace(request, workspace_id):
    workspace = Workspace.objects.filter(
        Q(id=workspace_id) & (Q(members=request.user) | Q(creator=request.user))
    ).first()
    if workspace:
        request.session['workspace_id'] = workspace.id
    return redirect(request.META.get('HTTP_REFERER', 'home'))


@login_required
def saveView(request, task_id):
    task = get_object_or_404(createTask, id=task_id)

    if request.method == "POST":
        form = EditTaskForm(request.POST, instance=task)
        if form.is_valid():
            form.save()

    return redirect('home')

@login_required
def onboard(request):
    if request.method == 'POST':
        form_type = request.POST.get('form_type')
        
        if form_type == 'create_workspace':
            form = CreateWorkspaceForm(request.POST)
            if form.is_valid():
                workspace = form.save(commit=False)
                workspace.creator = request.user
                workspace.save()
                workspace.members.add(request.user)
                request.session['workspace_id'] = workspace.id
                return redirect('home')
        
        elif form_type == 'join_workspace':
            invite_code = request.POST.get('invite_code', '').strip().upper()
            invite_link = request.POST.get('invite_link', '').strip()
            
            code = invite_code
            if not code and invite_link:
                import re
                match = re.search(r'/join/([A-Z0-9]+)', invite_link, re.IGNORECASE)
                if match:
                    code = match.group(1).upper()
            
            if code:
                try:
                    workspace = Workspace.objects.get(invite_code=code)
                    workspace.members.add(request.user)
                    request.session['workspace_id'] = workspace.id
                    return redirect('home')
                except Workspace.DoesNotExist:
                    messages.error(request, 'Invalid invite code. Please check and try again.')
            else:
                messages.error(request, 'Please enter an invite code or link.')
    
    return render(request, 'onboard.html', {'form': CreateWorkspaceForm()})


@login_required
@require_POST
def join_workspace(request):
    invite_code = request.POST.get('invite_code', '').strip().upper()
    invite_link = request.POST.get('invite_link', '').strip()
    
    code = invite_code
    if not code and invite_link:
        import re
        match = re.search(r'/join/([A-Z0-9]+)', invite_link, re.IGNORECASE)
        if match:
            code = match.group(1).upper()
    
    if code:
        try:
            workspace = Workspace.objects.get(invite_code=code)
            workspace.members.add(request.user)
            request.session['workspace_id'] = workspace.id
            return redirect('home')
        except Workspace.DoesNotExist:
            messages.error(request, 'Invalid invite code. Please check and try again.')
    else:
        messages.error(request, 'Please enter an invite code or link.')
    
    return redirect('onboard')


@login_required
@require_POST
def save_github_repo(request):
    repo = normalize_github_repo(request.POST.get('github_repo', ''))
    if not repo:
        messages.error(request, 'Enter a valid GitHub repository like owner/repo.')
        return redirect('code')

    GitHubRepositoryConnection.objects.update_or_create(
        user=request.user,
        defaults={'repo': repo},
    )
    request.session['github_repo'] = repo
    return redirect('code')


@login_required
@require_POST
def disconnect_github_repo(request):
    GitHubRepositoryConnection.objects.filter(user=request.user).delete()
    request.session.pop('github_repo', None)
    return redirect('code')


@login_required
@require_GET
def github_repo_api(request):
    return github_proxy_response(request)


@login_required
@require_GET
def github_commits_api(request):
    return github_proxy_response(request, '/commits', {
        'per_page': int_param(request, 'per_page', 30),
    })


@login_required
@require_GET
def github_branches_api(request):
    return github_proxy_response(request, '/branches', {
        'per_page': int_param(request, 'per_page', 50),
    })


@login_required
@require_GET
def github_pulls_api(request):
    state = request.GET.get('state', 'open')
    if state not in {'open', 'closed', 'all'}:
        state = 'open'

    return github_proxy_response(request, '/pulls', {
        'state': state,
        'per_page': int_param(request, 'per_page', 20),
    })


@login_required
@require_GET
def github_contributors_api(request):
    return github_proxy_response(request, '/contributors', {
        'per_page': int_param(request, 'per_page', 30),
    })


@login_required
@require_GET
def github_contents_api(request):
    path = request.GET.get('path', '').strip('/')
    endpoint = '/contents'
    if path:
        endpoint = f'{endpoint}/{quote(path, safe="/")}'

    return github_proxy_response(request, endpoint, {
        'ref': request.GET.get('ref', ''),
    })


@login_required
@require_POST
def delete_task(request, task_id):
    task = get_object_or_404(createTask, id=task_id)
    task.delete()
    return JsonResponse({'status': 'ok'})


@login_required
def create_workspace(request):
    if request.method == 'POST':
        form = CreateWorkspaceForm(request.POST) 
        if form.is_valid():
            workspace = form.save(commit=False)
            workspace.creator = request.user
            workspace.save()
            workspace.members.add(request.user)
            request.session['workspace_id'] = workspace.id
            return redirect('home')
    else:
        form = CreateWorkspaceForm()

    return render(request, 'onboard.html', {'form': form})
