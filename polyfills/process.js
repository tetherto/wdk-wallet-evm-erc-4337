import Process from 'bare-process'

export const platform = Process.platform
export const env = Process.env
export const argv = Process.argv
export const pid = Process.pid
export const version = Process.version

export default Process
