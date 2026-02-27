declare module 'mammoth/mammoth.browser' {
  interface MammothRawTextResult {
    value: string
    messages?: Array<{ type: string; message: string }>
  }

  interface MammothBrowserApi {
    extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<MammothRawTextResult>
  }

  const mammoth: MammothBrowserApi
  export default mammoth
}
