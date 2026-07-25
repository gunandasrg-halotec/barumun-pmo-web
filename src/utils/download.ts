import { AxiosResponse } from "axios";
/**
 * Convert Blob to file
 * @param {*} axiosResponse
 * @param {*} filename
 * @returns
 */
export const responseToFile = (
  axiosResponse: AxiosResponse,
  filename = "downloaded.pdf",
) => {
  return new File([axiosResponse.data], filename, {
    type: axiosResponse.data.type,
  });
};
/***
 * convert blob to download link
 */
export function responseToDownloadLink(
  axiosResponse: AxiosResponse,
  filename: string = "downloaded.pdf",
) {
  const href = URL.createObjectURL(axiosResponse.data);
  const link = document.createElement("a");
  let content = axiosResponse.headers["content-disposition"];

  link.href = href;
  link.setAttribute("download", `${filename}`); //or any other extension
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(href);
}

/**
 * convert blob to json
 * @param {*} axiosResponse
 * @returns
 */
export const responseToJson = (axiosResponse: AxiosResponse) => {
  const fileReader = new FileReader();
  return new Promise((resolve, reject) => {
    fileReader.onerror = () => {
      fileReader.abort();
      reject(new Error("Problem parsing file"));
    };

    fileReader.onload = (e: ProgressEvent<FileReader>) => {
      const result = e.target?.result;
      if (typeof result === "string") {
        resolve(JSON.parse(result));
      } else {
        reject(new Error("Problem parsing file"));
      }
    };
    fileReader.readAsText(axiosResponse.data);
  });
};
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
export async function delayedFunction(ms: number) {
  await sleep(ms); // Pauses execution for 1 second
}
