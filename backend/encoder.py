from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

# paraphrase-multilingual-MiniLM-L12-v2 was trained with a 128-token window.
MAX_LENGTH = 128


class OnnxEncoder:
    def __init__(self, model_path, tokenizer_path, max_length: int = MAX_LENGTH):
        model_path = str(model_path)
        tokenizer_path = str(tokenizer_path)

        for p in (model_path, tokenizer_path):
            if not Path(p).exists():
                raise FileNotFoundError(
                    f"{p} not found. Run: python backend/fetch_onnx.py"
                )

        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 1  # free tiers give a fraction of a CPU
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        self.session = ort.InferenceSession(
            model_path, sess_options=opts, providers=["CPUExecutionProvider"]
        )
        self.input_names = {i.name for i in self.session.get_inputs()}

        self.tokenizer = Tokenizer.from_file(tokenizer_path)
        self.tokenizer.enable_truncation(max_length=max_length)
        self.tokenizer.enable_padding()

    def encode(self, sentences, normalize_embeddings: bool = True, **_):
        single = isinstance(sentences, str)
        if single:
            sentences = [sentences]

        encoded = self.tokenizer.encode_batch(list(sentences))
        input_ids = np.array([e.ids for e in encoded], dtype=np.int64)
        attention_mask = np.array([e.attention_mask for e in encoded], dtype=np.int64)

        feed = {}
        if "input_ids" in self.input_names:
            feed["input_ids"] = input_ids
        if "attention_mask" in self.input_names:
            feed["attention_mask"] = attention_mask
        if "token_type_ids" in self.input_names:
            feed["token_type_ids"] = np.zeros_like(input_ids)

        token_embeddings = self.session.run(None, feed)[0]  # (batch, seq, hidden)

        # Mean pooling, ignoring padding positions
        mask = attention_mask[..., None].astype(np.float32)
        summed = (token_embeddings * mask).sum(axis=1)
        counts = np.clip(mask.sum(axis=1), 1e-9, None)
        embeddings = summed / counts

        if normalize_embeddings:
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            embeddings = embeddings / np.clip(norms, 1e-12, None)

        embeddings = embeddings.astype(np.float32)
        return embeddings[0] if single else embeddings