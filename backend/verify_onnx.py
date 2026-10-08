import numpy as np
from sentence_transformers import SentenceTransformer

from encoder import OnnxEncoder

QUERIES = [
    "comedy",
    "კომედია",
    "space exploration",
    "კოსმოსი",
    "a thief who steals secrets from dreams",
    "ქართველი რეჟისორის დოკუმენტური ფილმი",
    "dinosaur",
    "დინოზავრი",
    "romantic drama set in a village",
    "მუსიკალური კომედია 1948 წელი",
]


def main():
    print("Loading fp32 sentence-transformers model...")
    st = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")

    print("Loading int8 ONNX model...")
    onnx = OnnxEncoder("models/onnx/model_quantized.onnx", "models/tokenizer.json")

    a = np.asarray(st.encode(QUERIES, normalize_embeddings=True), dtype=np.float32)
    b = np.asarray(onnx.encode(QUERIES, normalize_embeddings=True), dtype=np.float32)

    cos = (a * b).sum(axis=1)

    print(f"\n{'query':<42}{'cosine(fp32, int8)':>20}")
    print("-" * 62)
    for q, c in zip(QUERIES, cos):
        flag = "" if c > 0.99 else ("  <- CHECK" if c > 0.95 else "  <- BAD")
        print(f"{q[:40]:<42}{c:>20.4f}{flag}")

    print("-" * 62)
    print(f"{'mean':<42}{cos.mean():>20.4f}")
    print(f"{'min':<42}{cos.min():>20.4f}")

    if cos.min() > 0.99:
        print("\nPASS - int8 queries are interchangeable with the fp32 vectors.")
    elif cos.min() > 0.95:
        print("\nMARGINAL - re-run benchmark_search.py and compare precision.")
    else:
        print("\nFAIL - do not switch; retrieval quality would degrade.")


if __name__ == "__main__":
    main()