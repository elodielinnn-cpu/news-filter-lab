# Feeds Fun adaptation

Upstream is https://github.com/Tiendil/feeds.fun at commit `6d9e7cc0ebb7611bdea52db4975ed824fbbe2373`.

The `extractAtTags` function in `adapter.mjs` is a JavaScript port of `ffun/ffun/librarian/tag_extractors.py::dog_tags_extractor`. It preserves extraction, lowercasing and deduplication, with explicit Unicode matching in JavaScript. The upstream BSD 3-Clause copyright and license are retained in `third-party/feeds-fun-LICENSE`.

The processing stages follow `ffun/ffun/librarian/processors/llm_general.py`: build an entry from title/URL/body, clean and bound input, call a model, extract and combine tags. The application-specific Python processor is not copied. This implementation uses overlapping text chunks with explicit completeness tracking, a local model endpoint, a fixed business taxonomy, evidence validation and content-addressed successful-response caching.

Normalization here uses canonical lowercase hyphenated tags and deduplication. The upstream spaCy/word-form normalizer is not imported. Proposed tags retain raw examples and evidence for human review.

The custom prompt targets industrial events and relationships. It replaces the upstream example prompt's search-scenario exercise. The two-domain product scope is reused from the project's existing scope module.

Runtime dependencies are downloaded on the GitHub runner. llama.cpp b6000 is distributed under MIT and the selected Qwen model under Apache-2.0. Their fixed download URLs and SHA-256 digests are recorded in `runtime.json`. Model weights and inference binaries are temporary runner files.
