param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Args
)

if (-not (Get-Command rg -ErrorAction SilentlyContinue)) {
  Write-Error "ripgrep (rg) is not installed. Install it or use Get-ChildItem / Select-String."
  exit 1
}

if ($Args.Count -eq 0) {
  rg --files
  exit 0
}

rg @Args
