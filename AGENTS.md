# news-filter-lab working rules

This repository is the cloud news-screening experiment for Luxshare. The active business scope is automotive and data center/communications; exclude 3C. The tagging workflow is a shadow trial and must not silently change the production news website or treat tag presence as proof of a Luxshare product relationship.

For management reading, tagging serves two decisions: whether a story belongs on the homepage, and what its main concrete development is. Show one main event tag per article; add another only when a separate development materially changes that decision. Keep detailed candidates and evidence for review, not as a long list of reader-facing tags. Do not spend time on fine-grained distinctions that cannot change the homepage decision or main event description.

Before editing, inspect the branch, status, recent commits, and relevant code. Protect pre-existing work. After editing, run relevant tests and workflow syntax checks, review the diff, stage only task files, and make one focused local commit.

Before a normal push:

1. Check whether the change duplicates existing functionality.
2. Check the underlying cause and state what the change tests or fixes. A green workflow or valid output format alone does not prove semantic accuracy.
3. Make configuration, failures, and comparison results detailed and machine-readable. Keep source evidence and distinguish incomplete processing from tag disagreement.
4. Confirm the remote is `https://github.com/elodielinnn-cpu/news-filter-lab.git`, the intended branch and commit range, and that no unrelated files or secrets are included.

Normal pushes are allowed after these checks. Never force push, rewrite shared history, merge, or deploy the public site without explicit user instruction. Keep model execution in the cloud; local commands are for development and validation only. Report what was actually tested and whether a push occurred.
