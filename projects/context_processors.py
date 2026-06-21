from .models import Workspace


def is_superior_user(user):
    return user.is_authenticated and (user.is_staff or user.is_superuser)


def current_workspace(request):
    if not request.user.is_authenticated:
        return {}
    workspace_id = request.session.get('workspace_id')
    workspace = None
    if workspace_id:
        try:
            if is_superior_user(request.user):
                workspace = Workspace.objects.get(id=workspace_id)
            else:
                workspace = Workspace.objects.get(id=workspace_id, members=request.user)
        except Workspace.DoesNotExist:
            request.session.pop('workspace_id', None)
    return {'current_workspace': workspace}
