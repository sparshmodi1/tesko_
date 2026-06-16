from .models import Workspace


def current_workspace(request):
    if not request.user.is_authenticated:
        return {}
    workspace_id = request.session.get('workspace_id')
    workspace = None
    if workspace_id:
        try:
            workspace = Workspace.objects.get(id=workspace_id, members=request.user)
        except Workspace.DoesNotExist:
            request.session.pop('workspace_id', None)
    return {'current_workspace': workspace}