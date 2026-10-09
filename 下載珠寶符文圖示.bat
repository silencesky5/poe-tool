<# : 批次檔部分
@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((Get-Content -LiteralPath '%~f0' -Encoding UTF8) -join [char]10)"
pause
goto :EOF
#>
# 從 herosiegedata.com 下載珠寶與符文圖示到 C:\poe-tool\img\hs
$dst = "C:\poe-tool\img\hs"
$base = "https://herosiegedata.com"
$jewels = [ordered]@{
  "乙太珠寶"="Aether"; "埃克桑珠寶"="Exan"; "烈焰珠寶"="Fieryzen"; "赫爾蒙珠寶"="Helmon";
  "萊爾康珠寶"="Lyrcon"; "瑪麗安珠寶"="Mariane"; "沃爾康珠寶"="Volcon"; "威爾頓珠寶"="Wilrden";
  "阿加特斯珠寶"="Agathetheum"; "青金石珠寶"="Lapis_Lazuli"; "萬象珠寶"="Omnipearl";
  "清晰珠寶"="Clean_Cut"; "神話獅珠寶"="Mythgonlion"; "珍珠珠寶"="Pearlescento"; "特拉瑪爾珠寶"="Tramal"
}
$runes = "El Eld Tir Nef Eth Ith Tal Ral Ort Thul Amn Sol Shael Dol Hel Io Lum Ko Fal Lem Pul Um Mal Ist Gul Vex Ohm Lo Sur Ber Jah Cham Zod Fawn Flo Nju Jol".Split(" ")

$ok = 0; $fail = 0
foreach ($k in $jewels.Keys) {
  try { Invoke-WebRequest -Uri "$base/icons_gem/Jewel_$($jewels[$k])_spr_0.png" -OutFile (Join-Path $dst "$k.png") -UseBasicParsing; $ok++ }
  catch { Write-Host "失敗：$k"; $fail++ }
}
foreach ($r in $runes) {
  try { Invoke-WebRequest -Uri "$base/icons_runes/Rune_${r}_spr_0.png" -OutFile (Join-Path $dst "Rune_${r}_spr_0.png") -UseBasicParsing; $ok++ }
  catch { Write-Host "失敗：$r"; $fail++ }
}
Write-Host ""
Write-Host "完成：成功 $ok 張，失敗 $fail 張。接著跑 上傳網站.bat 就會顯示。"
