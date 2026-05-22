from __future__ import annotations

import warnings
from typing import Literal

type ExecutionDevice = Literal["cuda", "mps", "cpu"]


def detect_best_device() -> ExecutionDevice:
    try:
        import torch
    except ImportError:
        return "cpu"

    try:
        # Some torch builds emit noisy warnings when CUDA runtime is incompatible.
        # We intentionally fall back to CPU in that case.
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", category=UserWarning)
            if torch.cuda.is_available():
                return "cuda"
    except Exception:
        pass

    try:
        # `is_built()` guards for platforms where MPS backend exists but isn't compiled in.
        mps_backend = getattr(torch.backends, "mps", None)
        if (
            mps_backend is not None
            and getattr(mps_backend, "is_built", lambda: False)()
            and mps_backend.is_available()
        ):
            return "mps"
    except Exception:
        pass

    return "cpu"
