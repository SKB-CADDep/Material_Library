from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.dependencies import get_app_state


@asynccontextmanager
async def lifespan(app: FastAPI):
    state = get_app_state()
    app.state.app_state = state
    yield


app = FastAPI(title="Material Library API", lifespan=lifespan)
