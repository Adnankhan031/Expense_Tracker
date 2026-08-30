from paddleocr import PaddleOCR

IMAGE_PATH = r"C:\Users\ADNAN\OneDrive\Desktop\Expence Tracker\uploads\WhatsApp Image 2026-08-30 at 06.58.33.jpeg"

print("Starting PaddleOCR...")

ocr = PaddleOCR(
    lang="japan"
)

print("Running OCR...")

result = ocr.predict(IMAGE_PATH)

print("\n========== OCR RESULT ==========\n")

for page in result:
    print(page)

print("\n========== DONE ==========")