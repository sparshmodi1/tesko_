from django import forms
from django.contrib.auth.models import User
from .models import createTask, Workspace

class CreateTaskForm(forms.ModelForm):
    class Meta:
        model = createTask
        exclude = ['workspace']

    def __init__(self, *args, workspace=None, **kwargs):
        super().__init__(*args, **kwargs)

        if workspace:
            self.fields['assignee'].queryset = workspace.members.all()
        else:
            self.fields['assignee'].queryset = User.objects.filter(is_active=True)

        self.fields['assignee'].label_from_instance = lambda obj: f"{obj.first_name or obj.username} ({(obj.first_name or obj.username)[:1]})"

class EditTaskForm(forms.ModelForm):
    class Meta:
        model = createTask
        fields = ['status', 'type', 'assignee', 'description']
        widgets = {
            'status': forms.Select(attrs={
                'class': 'modal-select'
            }),
            'type': forms.Select(attrs={
                'class': 'modal-select'
            }),
            'assignee': forms.Select(attrs={
                'class': 'modal-select'
            }),
            'description': forms.Textarea(attrs={
                'class': 'modal-textarea',
                'placeholder': 'Add a description...',
                'rows': 4
            }),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['assignee'].queryset = User.objects.filter(is_active=True)
        self.fields['assignee'].label_from_instance = lambda obj: f"{obj.first_name or obj.username} ({(obj.first_name or obj.username)[:1]})"


class BacklogTaskForm(forms.ModelForm):
    class Meta:
        model = createTask
        exclude = ['workspace']
        widgets = {
            'title': forms.TextInput(attrs={
                'class': 'create-input',
                'placeholder': 'Enter issue title',
            }),
            'type': forms.Select(attrs={
                'class': 'create-input',
            }),
            'priority': forms.Select(attrs={
                'class': 'create-input',
            }),
            'assignee': forms.Select(attrs={
                'class': 'create-input',
            }),
            'status': forms.Select(attrs={
                'class': 'create-input',
            }),
            'estimate': forms.TextInput(attrs={
                'class': 'create-input',
                'placeholder': 'e.g. 2h, 30m',
            }),
            'description': forms.Textarea(attrs={
                'class': 'create-input',
                'placeholder': 'Description (optional)',
                'rows': 3,
            }),
        }
        labels = {
            'title': 'Issue',
            'type': 'Type',
            'priority': 'Priority',
            'assignee': 'Assignee',
            'status': 'Status',
            'estimate': 'Estimate',
            'description': 'Description',
        }

    def clean_title(self):
        title = self.cleaned_data.get('title')
        if not title or not title.strip():
            raise forms.ValidationError("Issue title cannot be blank.")
        return title.strip()

    def clean_estimate(self):
        estimate = self.cleaned_data.get('estimate', '').strip()
        return estimate
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['assignee'].queryset = User.objects.filter(is_active=True)
        
    
class CreateWorkspaceForm(forms.ModelForm):
    class Meta:
        model = Workspace
        fields = ['workspaceName', 'typeofws']
        widgets = {
            'workspaceName': forms.TextInput(attrs={
                'class': 'field-input',
                'placeholder': 'e.g. Design Team, Backend Squad…',
                'id': 'workspaceNameInput',
                'autocomplete': 'off'
            }),

            'typeofws': forms.HiddenInput(attrs={
                'id': 'wsTypeVal'
            }),
        }