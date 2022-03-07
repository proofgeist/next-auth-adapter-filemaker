import fetch from "isomorphic-unfetch";
import {
  CreateParams,
  CreateResponse,
  DeleteResponse,
  FieldData,
  GenericPortalData,
  GetParams,
  GetResponse,
  ListParams,
  Query,
  UpdateParams,
  UpdateResponse,
  DeleteParams,
} from "./client-types";

type ClientObjectProps = {
  server: string;
  db: string;
  apiKey: string;
  ottoPort?: number;
  layout?: string;
};

class FileMakerError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function fmDAPI(options: ClientObjectProps) {
  const ottoPort = options.ottoPort ?? 3030;
  const baseUrl = `${options.server}:${ottoPort}/fmi/data/vLatest/databases/${options.db}`;

  async function request(params: {
    url: string;
    body?: object;
    query?: Record<string, string>;
    method?: string;
  }) {
    const { query, body, method = "POST" } = params;
    const url = new URL(`${baseUrl}${params.url}`);

    const fetchOpts: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
    };

    if (body) fetchOpts.body = JSON.stringify(body);
    if (query) url.search = new URLSearchParams(query).toString();

    const res = await fetch(url.toString(), { ...fetchOpts });

    let respData: any;
    try {
      respData = await res.json();
    } catch {
      respData = {};
    }

    if (!res.ok) {
      throw new FileMakerError(
        respData?.messages?.[0].code ?? "500",
        `Filemaker Data API failed with (${res.status}): ${JSON.stringify(
          respData,
          null,
          2
        )}`
      );
    }

    return respData.response;
  }

  return {
    async list<
      T extends FieldData = FieldData,
      U extends GenericPortalData = GenericPortalData
    >(layout: string, params?: ListParams<T, U>): Promise<GetResponse<T, U>> {
      return await request({
        url: `/layouts/${layout}/records`,
        method: "GET",
        // @ts-ignore
        query: params,
      });
    },
    async create<
      T extends FieldData = FieldData,
      U extends GenericPortalData = GenericPortalData
    >(
      layout: string,
      fieldData: Partial<T>,
      params?: CreateParams<U>
    ): Promise<CreateResponse> {
      return await request({
        url: `/layouts/${layout}/records`,
        body: { fieldData, ...params },
      });
    },
    async get<
      T extends FieldData = FieldData,
      U extends GenericPortalData = GenericPortalData
    >(
      layout: string,
      recordId: number,
      params?: GetParams<U>
    ): Promise<GetResponse<T, U>> {
      return await request({
        url: `/layouts/${layout}/records/${recordId}`,
        method: "GET",
      });
    },
    async update<
      T extends FieldData = FieldData,
      U extends GenericPortalData = GenericPortalData
    >(
      layout: string,
      recordId: number,
      fieldData: Partial<T>,
      params?: UpdateParams<U>
    ): Promise<UpdateResponse> {
      return await request({
        url: `/layouts/${layout}/records/${recordId}`,
        body: { fieldData, ...params },
        method: "PATCH",
      });
    },
    async delete<
      T extends FieldData = FieldData,
      U extends GenericPortalData = GenericPortalData
    >(
      layout: string,
      recordId: number,
      params?: DeleteParams
    ): Promise<DeleteResponse> {
      return await request({
        url: `/layouts/${layout}/records/${recordId}`,
        query: params,
        method: "DELETE",
      });
    },
    async find<
      T extends FieldData = FieldData,
      U extends GenericPortalData = GenericPortalData
    >(
      layout: string,
      query: Query<T> | Array<Query<T>>,
      params: ListParams<T, U> = {},
      ignoreEmptyResult = false
    ): Promise<GetResponse<T, U>> {
      if (!Array.isArray(query)) {
        query = [query];
      }
      try {
        return await request({
          url: `/layouts/${layout}/_find`,
          body: { query, ...params },
          method: "POST",
        });
      } catch (e) {
        if (
          ignoreEmptyResult &&
          e instanceof FileMakerError &&
          e.code === "401"
        )
          return { data: [] };
        throw e;
      }
    },
  };
}

export default fmDAPI;