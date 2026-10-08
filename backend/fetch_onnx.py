from huggingface_hub import hf_hub_download

REPO = "Xenova/paraphrase-multilingual-MiniLM-L12-v2"
FILES = ["onnx/model_quantized.onnx", "tokenizer.json"]


def main():
    for name in FILES:
        path = hf_hub_download(REPO, name, local_dir="models")
        print(f"downloaded {name} -> {path}")
    print("\nReady. The API will load these from models/.")


if __name__ == "__main__":
    main()