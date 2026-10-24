Set WshShell = CreateObject("WScript.Shell")
' Define o diretório atual como a pasta onde está este script
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
' Executa o servidor Node em segundo plano (o número 0 esconde completamente a janela)
WshShell.Run "node server/index.mjs", 0, False