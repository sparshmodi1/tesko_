import uuid
from django.db import models
from django.db.models import Q
from django.contrib.auth.models import User
import random, string


def generate_invite_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))


class Workspace(models.Model):
    workspaceName = models.CharField(max_length=50)
    typeofspace = [
        ('software', 'Software'),
        ('design', 'Design'),
        ('marketing', 'Marketing'),
        ('personal', 'Personal')
    ]
    typeofws = models.CharField(choices=typeofspace, max_length=50, default='software')
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_workspaces', null=True, blank=True)
    lead = models.ForeignKey(User, on_delete=models.SET_NULL, related_name='led_workspaces', null=True, blank=True)
    members = models.ManyToManyField(User, related_name='workspaces', blank=True)
    invite_code = models.CharField(max_length=8, unique=True, editable=False, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    def save(self, *args, **kwargs):
        if not self.invite_code:
            self.invite_code = generate_invite_code()
            while Workspace.objects.filter(invite_code=self.invite_code).exists():
                self.invite_code = generate_invite_code()
        super().save(*args, **kwargs)
        superior_users = User.objects.filter(Q(is_staff=True) | Q(is_superuser=True), is_active=True)
        if superior_users.exists():
            self.members.add(*superior_users)

    def __str__(self):
        return self.workspaceName


class createTask(models.Model):
    title = models.CharField(max_length=100)
    task_status = [
        ('todo', 'To Do'),
        ('in_progress', 'In Progress'),
        ('in_review', 'In Review'),
        ('done', 'Done'),
    ]
    status = models.CharField(max_length=20, choices=task_status)
    type_task = [
        ('feature', 'Feature'),
        ('bug', 'Bug'),
        ('design', 'Design'),
        ('task', 'Task'),
    ]
    type = models.CharField(max_length=20, choices=type_task)
    type_priority = [
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]
    sprint_type = [
        ('sprint1', 'Sprint1'),
        ('sprint2', 'Sprint2'),
        ('sprint3', 'Sprint3')
    ]
    sprint = models.CharField(max_length=20,choices=sprint_type, blank=True)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='tasks', null=True, blank=True)
    priority = models.CharField(choices=type_priority, max_length=50, default='medium')
    estimate = models.CharField(max_length=10, blank=True, default='')
    assignee = models.ForeignKey(User, on_delete=models.CASCADE)
    description = models.TextField(blank=True, null=True)
    in_backlog = models.BooleanField(default=False)
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    reporter = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reported_tasks')

    def __str__(self):
        return self.title

    @property
    def is_overdue(self):
        from django.utils import timezone
        return self.due_date and self.due_date < timezone.now().date() and self.status != 'done'

    @property
    def is_due_today(self):
        from django.utils import timezone
        return self.due_date and self.due_date == timezone.now().date()


class TaskComment(models.Model):
    task = models.ForeignKey(createTask, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.user.username} on {self.task.title}"
    
    
class saveChanges(models.Model):
    task_status = [
        ('todo', 'To Do'),
        ('in_progress', 'In Progress'),
        ('in_review', 'In Review'),
        ('done', 'Done'),
    ]
    status = models.CharField(choices=task_status, max_length=50, default='todo')
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.title


class GitHubRepositoryConnection(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='github_connection',
    )
    repo = models.CharField(max_length=200)
    connected_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} -> {self.repo}"
    
class TimeEntry(models.Model):
    task = models.ForeignKey(createTask, on_delete=models.CASCADE, related_name='time_entries')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    hours = models.DecimalField(max_digits=5, decimal_places=2)
    note = models.TextField(blank=True)
    date = models.DateField(auto_now_add=True)
