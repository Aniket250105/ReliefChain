import os
import glob
import re

def replace_alerts_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'alert(' not in content:
        return
        
    print(f"Modifying {filepath}")
    
    # Check if react-hot-toast is already imported
    has_toast_import = 'import { toast } from \'react-hot-toast\'' in content or 'import {toast} from "react-hot-toast"' in content
    
    # Replace alert( with toast.error(
    content = re.sub(r'alert\(', 'toast.error(', content)
    
    if not has_toast_import:
        # insert after the last import
        imports_end = content.rfind('\nimport ')
        if imports_end != -1:
            end_of_line = content.find('\n', imports_end + 1)
            content = content[:end_of_line] + "\nimport { toast } from 'react-hot-toast';" + content[end_of_line:]
        else:
            content = "import { toast } from 'react-hot-toast';\n" + content
            
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

# Search apps/web/src for tsx and ts files
pattern = 'apps/web/src/**/*.ts*'
for filepath in glob.glob(pattern, recursive=True):
    if os.path.isfile(filepath):
        replace_alerts_in_file(filepath)
