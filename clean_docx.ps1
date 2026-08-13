$docxPath = "C:\Users\HEllo\Downloads\Job_Hunter_Agent.docx"
$zipPath = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "temp_job_hunter.zip")
Copy-Item $docxPath $zipPath -Force
$tempDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
    Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force
    $docXmlPath = [System.IO.Path]::Combine($tempDir, "word", "document.xml")
    
    if (Test-Path $docXmlPath) {
        $xmlContent = Get-Content $docXmlPath -Raw -Encoding UTF8
        
        # We can extract text node values directly by parsing the xml or using a regex for <w:t> tags
        # Let's extract each <w:t> tag's inner text.
        # Inside docx, paragraphs are separated by <w:p>. So let's replace <w:p> and <w:p ...> with newlines,
        # then extract <w:t> tags or strip tags.
        
        # Replace paragraph tags with newlines
        $xmlContent = $xmlContent -replace '<w:p\b[^>]*>', "`r`n"
        $xmlContent = $xmlContent -replace '<w:br\b[^>]*>', "`r`n"
        $xmlContent = $xmlContent -replace '<w:tab\b[^>]*>', " `t "
        
        # Strip all XML tags
        $cleanText = $xmlContent -replace '<[^>]+>', ''
        
        # Decode common HTML/XML entities
        $cleanText = $cleanText -replace '&amp;', '&' -replace '&lt;', '<' -replace '&gt;', '>' -replace '&quot;', '"' -replace '&apos;', "'"
        
        # Collapse multiple spaces or empty lines
        $cleanText = $cleanText -replace ' +', ' '
        
        $cleanText | Out-File -FilePath "c:\Users\HEllo\Desktop\AI Based Project\job_hunter_brief_clean.txt" -Encoding UTF8
        Write-Output "Successfully cleaned. Length: $($cleanText.Length)"
    } else {
        Write-Output "Error: document.xml not found"
    }
} catch {
    Write-Output "Error: $_"
} finally {
    if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue }
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force -ErrorAction SilentlyContinue }
}
