import pytest
from rest_framework.test import APIClient
from apps.accounts.management.commands.seed_demo_data import run_seed


@pytest.fixture(autouse=True)
def seed_data(db):
    run_seed()


@pytest.fixture
def api_client(db):
    return APIClient()
