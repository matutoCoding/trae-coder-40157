import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

process.env.DIST = join(__dirname, '../dist')
process.env.PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(__dirname, '../public')
  : process.env.DIST

let win: BrowserWindow | null = null
const preload = join(__dirname, '../dist-electron/preload.js')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = join(process.env.DIST, 'index.html')

function createWindow() {
  win = new BrowserWindow({
    title: '垂钓园钓位预订系统',
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 768,
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  if (url) {
    win.loadURL(url)
  } else {
    win.loadFile(indexHtml)
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})
