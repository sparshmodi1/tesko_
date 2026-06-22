from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from projects.models import Workspace


def is_superior_user(user):
    return user.is_authenticated and (user.is_staff or user.is_superuser)


def sync_superior_workspace_memberships():
    superior_users = User.objects.filter(is_active=True).filter(is_staff=True) | User.objects.filter(is_active=True).filter(is_superuser=True)
    superior_users = superior_users.distinct()
    if not superior_users.exists():
        return

    for workspace in Workspace.objects.all():
        workspace.members.add(*superior_users)


def get_user_workspace(user):
    if is_superior_user(user):
        sync_superior_workspace_memberships()
        return Workspace.objects.first()
    return Workspace.objects.filter(members=user).first()


def login_view(request):
    if request.method == "POST":
        username = request.POST.get('username')
        password = request.POST.get('password')

        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            workspace = get_user_workspace(user)
            if workspace:
                request.session['workspace_id'] = workspace.id
                return redirect('home')
            else:
                return redirect('onboard')
        else:
            return render(request, 'login.html', {'error': 'Invalid Credentials'})
    return render(request, 'login.html')


def signup_view(request):
    if request.user.is_authenticated:
        return redirect('login')

    if request.method == "POST":
        first_name = request.POST.get('first_name')
        last_name = request.POST.get('last_name')
        email = request.POST.get('email')
        password = request.POST.get('password')

        if User.objects.filter(username=email).exists() or User.objects.filter(email=email).exists():
            return render(request, 'signup.html', {'error': 'Email already registered'})

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name
        )
        
        login(request, user)
        return redirect('onboard')

    return render(request, 'signup.html')


def logout_view(request):
    logout(request)
    return redirect('login')

