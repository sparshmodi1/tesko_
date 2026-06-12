from django.contrib import admin
from .models import GitHubRepositoryConnection, createTask, Workspace

@admin.register(createTask)
class TaskAdmin(admin.ModelAdmin):

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        if obj is None:  # Only on new task creation
            workspace = Workspace.objects.filter(
                members=request.user
            ).first()
            if workspace:
                form.base_fields['workspace'].initial = workspace
        return form

    def save_model(self, request, obj, form, change):
        # Safety net: if no workspace set, assign user's workspace
        if not obj.workspace:
            obj.workspace = Workspace.objects.filter(
                members=request.user
            ).first()
        super().save_model(request, obj, form, change)

