"""Write a timeline page shell: python3 make_page.py <id> "<Title>" "<description>" """
import sys
pid, title, desc = sys.argv[1:4]
html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/timeline.css">
</head>
<body>
<div class="wrap" id="app"><noscript>This interactive timeline needs JavaScript.</noscript></div>
<script src="data/{pid}.js"></script>
<script src="assets/timeline.js"></script>
</body>
</html>
'''
open(f"{pid}.html", "w").write(html)
