import os
import glob
import re

def update_colors_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Replace solid backgrounds of #064E3B with Navy (#172554)
    content = content.replace('bg-[#064E3B]', 'bg-[#172554]')
    
    # Replace login page gradient with Navy -> Forest gradient
    content = content.replace('linear-gradient(135deg, #064E3B 0%, #065F46 40%, #047857 100%)', 'linear-gradient(135deg, #172554 0%, #064E3B 100%)')
    
    # We leave text-[#064E3B] and border-[#064E3B] as Forest Green so we have a true 3-color palette!
    # Cream is already #F8E7C9.
    
    # If it's a specific top navigation bar, let's make the logo text Navy instead of Forest so it anchors the theme
    if 'TopNavbar.tsx' in filepath:
        content = content.replace('text-[#064E3B] bg-[#F8E7C9]', 'text-[#172554] bg-[#F8E7C9]')
    
    if content != original_content:
        print(f"Updated colors in {filepath}")
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

# Search apps/web/src for tsx files
pattern = 'apps/web/src/**/*.tsx'
for filepath in glob.glob(pattern, recursive=True):
    if os.path.isfile(filepath):
        update_colors_in_file(filepath)
