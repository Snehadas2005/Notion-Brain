def get_all_pages():
    return [
        {
            "id": "page-001",
            "url": "https://notion.so/page-001",
            "created_time": "2024-01-01T10:00:00.000Z",
            "last_edited_time": "2024-03-10T15:30:00.000Z",
            "properties": {
                "title": {"title": [{"plain_text": "Machine Learning Notes"}]}
            }
        },
        {
            "id": "page-002",
            "url": "https://notion.so/page-002",
            "created_time": "2024-01-05T11:00:00.000Z",
            "last_edited_time": "2024-03-11T09:00:00.000Z",
            "properties": {
                "title": {"title": [{"plain_text": "Neural Networks"}]}
            }
        },
        {
            "id": "page-003",
            "url": "https://notion.so/page-003",
            "created_time": "2024-01-10T12:00:00.000Z",
            "last_edited_time": "2024-03-12T14:00:00.000Z",
            "properties": {
                "title": {"title": [{"plain_text": "Python Tips"}]}
            }
        },
        {
            "id": "page-004",
            "url": "https://notion.so/page-004",
            "created_time": "2024-02-01T08:00:00.000Z",
            "last_edited_time": "2024-03-13T10:00:00.000Z",
            "properties": {
                "title": {"title": [{"plain_text": "Deep Learning Research"}]}
            }
        },
        {
            "id": "page-005",
            "url": "https://notion.so/page-005",
            "created_time": "2024-02-15T09:00:00.000Z",
            "last_edited_time": "2024-03-14T11:00:00.000Z",
            "properties": {
                "title": {"title": [{"plain_text": "Project Ideas"}]}
            }
        },
    ]


def get_page_blocks(page_id: str):
    blocks = {
        "page-001": [
            {
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [
                        {"plain_text": "ML is a subset of AI. See also ", "mention": {}},
                        {"plain_text": "Neural Networks", "mention": {"type": "page", "page": {"id": "page-002"}}},
                    ]
                }
            },
            {
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"plain_text": "Supervised learning uses labeled data to train models. Common algorithms include linear regression, decision trees, and SVMs."}]
                }
            },
        ],
        "page-002": [
            {
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [
                        {"plain_text": "Neural networks are the backbone of "},
                        {"plain_text": "Deep Learning", "mention": {"type": "page", "page": {"id": "page-004"}}},
                    ]
                }
            },
            {
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"plain_text": "Layers of neurons process data using weights and activation functions like ReLU and sigmoid. Backpropagation adjusts weights during training."}]
                }
            },
        ],
        "page-003": [
            {
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"plain_text": "Use list comprehensions for cleaner Python code. Virtual environments keep dependencies isolated per project."}]
                }
            },
        ],
        "page-004": [
            {
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [
                        {"plain_text": "Deep learning research builds on "},
                        {"plain_text": "Machine Learning Notes", "mention": {"type": "page", "page": {"id": "page-001"}}},
                    ]
                }
            },
            {
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"plain_text": "Transformers, CNNs, and RNNs are key deep learning architectures. GPU acceleration is essential for training large models efficiently."}]
                }
            },
        ],
        "page-005": [
            {
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"plain_text": "Build an AI-powered note summarizer. Create a Python CLI tool for automating repetitive dev tasks."}]
                }
            },
        ],
    }
    return blocks.get(page_id, [])