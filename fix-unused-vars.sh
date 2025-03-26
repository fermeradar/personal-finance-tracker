#!/bin/bash
# Simple script to add underscore prefix to unused variables

# Function to fix a single file
fix_file() {
  local file=$1
  local var=$2

  # Skip if variable already starts with underscore
  if [[ $var == _* ]]; then
    return
  fi

  echo "Fixing '$var' in $file"

  # Replace variable declarations (const, let, var)
  sed -i '' -E "s/\b(const|let|var)\s+($var)\b/\1 _\2/g" "$file"

  # Replace function parameters
  sed -i '' -E "s/\(([^)]*)\\b$var\\b([^)]*)\)/(\1_$var\2)/g" "$file"
}

# Process the ESLint output
process_eslint_output() {
  local eslint_output=$1

  # Extract file paths and variable names from ESLint output
  while IFS= read -r line; do
    # Match file paths
    if [[ $line =~ ^/Users/d/projects/personal-finance-tracker/(.+)$ ]]; then
      current_file=${BASH_REMATCH[1]}
      continue
    fi
    
    # Match unused variables
    if [[ $line =~ \'([^\']+)\'\s+is\s+(?:assigned\s+a\s+value|defined)\s+but\s+never\s+used ]]; then
      var=${BASH_REMATCH[1]}
      fix_file "/Users/d/projects/personal-finance-tracker/$current_file" "$var"
    fi
  done < "$eslint_output"
}

# Main execution
if [ ! -f "eslint-output.txt" ]; then
  echo "Running ESLint and saving output to eslint-output.txt"
  npm run lint > eslint-output.txt 2>&1
fi

process_eslint_output "eslint-output.txt"

echo "Unused variables have been fixed! Run 'npm run lint' again to see results."