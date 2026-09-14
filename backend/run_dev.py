"""Windows-compatible dev server entrypoint.

On Python 3.14+ on Windows, asyncio.run() uses ProactorEventLoop by default
which is incompatible with psycopg3 async. We create SelectorEventLoop
explicitly and run uvicorn inside it.
"""
import sys
import asyncio
import selectors
import uvicorn


async def serve():
    config = uvicorn.Config(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=["app"],
    )
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    if sys.platform == "win32":
        loop = asyncio.SelectorEventLoop(selectors.SelectSelector())
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(serve())
        finally:
            loop.close()
    else:
        asyncio.run(serve())
