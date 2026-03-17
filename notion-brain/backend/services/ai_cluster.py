from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# Load a fast, lightweight model
model = SentenceTransformer("all-MiniLM-L6-v2")

def add_semantic_edges(graph: dict, page_texts: dict, threshold=0.72) -> dict:
    """Adds semantic edges between pages discussing similar topics."""
    ids = list(page_texts.keys())
    # Filter out empty texts
    ids = [i for i in ids if page_texts[i].strip()]
    if len(ids) < 2:
        return graph
        
    texts = [page_texts[i] for i in ids]

    embeddings = model.encode(texts, show_progress_bar=False)
    sim_matrix = cosine_similarity(embeddings)

    existing = {(l["source"], l["target"]) for l in graph["links"]}

    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            if sim_matrix[i][j] > threshold:
                pair = (ids[i], ids[j])
                reverse_pair = (ids[j], ids[i])
                if pair not in existing and reverse_pair not in existing:
                    graph["links"].append({
                        "source": ids[i],
                        "target": ids[j],
                        "semantic": True  # Differentiate in frontend
                    })
    return graph
