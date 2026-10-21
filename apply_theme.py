import os
import glob
import re

def rewrite_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    # 1. Update globals.css if it's the one
    if 'globals.css' in filepath:
        if '@theme' not in content:
            theme_block = """
@theme {
  --color-forest: #0F3D3A;
  --color-gold: #F4B13B;
  --color-terracotta: #E0745E;
  --color-sand: #F2E6D6;
}
"""
            content = content.replace('@import "tailwindcss";', '@import "tailwindcss";\n' + theme_block)
            content = content.replace('--background: #F8E7C9;', '--background: var(--color-sand);')
            content = content.replace('--foreground: #064E3B;', '--foreground: var(--color-forest);')

    # 2. General color replacements in tsx files
    # Old Navy (#172554) -> forest
    content = content.replace('bg-[#172554]', 'bg-forest')
    content = content.replace('text-[#172554]', 'text-forest')
    content = content.replace('border-[#172554]', 'border-forest')
    
    # Old Forest (#064E3B) -> forest
    content = content.replace('bg-[#064E3B]', 'bg-forest')
    content = content.replace('text-[#064E3B]', 'text-forest')
    content = content.replace('border-[#064E3B]', 'border-forest')
    
    # Old Cream (#F8E7C9) -> sand
    content = content.replace('bg-[#F8E7C9]', 'bg-sand')
    content = content.replace('text-[#F8E7C9]', 'text-sand')
    content = content.replace('border-[#F8E7C9]', 'border-sand')
    
    # Fix gradients
    content = content.replace('linear-gradient(135deg, #172554 0%, #064E3B 100%)', 'linear-gradient(135deg, var(--color-forest) 0%, #0a2927 100%)')

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

for filepath in glob.glob('apps/web/src/**/*.ts*', recursive=True):
    if os.path.isfile(filepath):
        rewrite_file(filepath)

for filepath in glob.glob('apps/web/src/**/*.css', recursive=True):
    if os.path.isfile(filepath):
        rewrite_file(filepath)
