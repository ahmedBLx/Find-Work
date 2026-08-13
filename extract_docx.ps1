$docxPath = "C:\Users\HEllo\Downloads\Job_Hunter_Agent.docx"
$zipPath = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "temp_job_hunter.zip")
Copy-Item $docxPath $zipPath -Force
$tempDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
    # Extract ZIP
    Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force
    $docXmlPath = [System.IO.Path]::Combine($tempDir, "word", "document.xml")
    
    if (Test-Path $docXmlPath) {
        $xmlContent = Get-Content $docXmlPath -Raw -Encoding UTF8
        # Simple extraction of text inside <w:t> tags using regex to make it robust
        $matches = [regex]::Matches($xmlContent, '<w:t.*?>(.*?)</w:t>')
        $texts = foreach ($match in $matches) {
            $match.Groups[1].Value
        }
        $fullText = $texts -join " "
        
        # Unescape XML entities
        $fullText = $fullText -replace '&amp;', '&' -replace '&lt;', '<' -replace '&gt;', '>' -replace '&quot;', '"' -replace '&apos;', "'"
        
        # Also clean up a bit of spacing or formatting
        $fullText | Out-File -FilePath "c:\Users\HEllo\Desktop\AI Based Project\job_hunter_brief.txt" -Encoding UTF8
        Write-Output "Successfully extracted to job_hunter_brief.txt. Length: $($fullText.Length)"
    } else {
        Write-Output "Error: word/document.xml not found in docx zip"
    }
} catch {
    Write-Output "Error occurred: $_"
} finally {
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $zipPath) {
        Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue
    }
}
