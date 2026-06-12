from django.urls import path
from .views import *

urlpatterns = [
    path('accounts/login/', login_view, name="login"),
    path('accounts/signup/', signup_view, name="signup"),
    path('logout/', logout_view, name='logout'),
]
