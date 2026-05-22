from parsearena.parsers.device import detect_best_device

def test_detect_best_device():
    print(detect_best_device())
    assert detect_best_device() in ["cuda", "mps", "cpu"]

test_detect_best_device()
print("here")