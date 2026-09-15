import asyncio


def selector_loop_factory() -> asyncio.AbstractEventLoop:
    """Custom uvicorn loop factory for local Windows dev.

    psycopg's async driver requires a selector-based event loop, but
    uvicorn's built-in "asyncio" loop setup hardcodes ProactorEventLoop on
    win32 unless running with --reload/multiple workers. Point uvicorn at
    this factory explicitly instead of relying on that reload side effect:

        uvicorn app.main:app --loop app.core.event_loop:selector_loop_factory

    Not needed on Linux (production/Railway), where uvicorn already
    selects SelectorEventLoop by default.
    """
    return asyncio.SelectorEventLoop()
