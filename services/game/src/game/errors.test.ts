import { describe, expect, it } from "vitest";
import { HttpException, HttpStatus } from "@nestjs/common";
import { EngineErrorFilter } from "./errors.js";

function createMockHost() {
  let capturedStatus: number | undefined;
  let capturedBody: unknown;

  const res = {
    status(s: number) {
      capturedStatus = s;
      return this;
    },
    json(body: unknown) {
      capturedBody = body;
      return this;
    },
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({}),
      getNext: () => ({}),
    }),
  } as any;

  return {
    host,
    getResult: () => ({ status: capturedStatus, body: capturedBody }),
  };
}

describe("EngineErrorFilter", () => {
  const filter = new EngineErrorFilter();

  it("handles HttpException directly", () => {
    const { host, getResult } = createMockHost();
    const error = new HttpException("Custom HTTP exception", HttpStatus.BAD_GATEWAY);

    filter.catch(error, host);
    expect(getResult()).toEqual({
      status: HttpStatus.BAD_GATEWAY,
      body: { error: "Custom HTTP exception" },
    });
  });

  it("maps known error codes to corresponding HTTP statuses", () => {
    const mappings: Array<[number, HttpStatus]> = [
      [503, HttpStatus.SERVICE_UNAVAILABLE],
      [403, HttpStatus.FORBIDDEN],
      [409, HttpStatus.CONFLICT],
      [400, HttpStatus.BAD_REQUEST],
      [429, HttpStatus.TOO_MANY_REQUESTS],
      [404, HttpStatus.NOT_FOUND],
      [410, HttpStatus.GONE],
    ];

    for (const [code, expectedStatus] of mappings) {
      const { host, getResult } = createMockHost();
      const err = Object.assign(new Error(`error with code ${code}`), { code });
      filter.catch(err, host);
      expect(getResult()).toEqual({
        status: expectedStatus,
        body: { error: `error with code ${code}` },
      });
    }
  });

  it("maps unknown error codes to 500 internal error without leaking details", () => {
    const { host, getResult } = createMockHost();
    const err = Object.assign(new Error("secret db leak"), { code: 999 });

    filter.catch(err, host);
    expect(getResult()).toEqual({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { error: "internal error" },
    });
  });

  it("handles non-Error objects with code", () => {
    const { host, getResult } = createMockHost();
    filter.catch({ code: 400 }, host);

    expect(getResult()).toEqual({
      status: HttpStatus.BAD_REQUEST,
      body: { error: "internal error" },
    });
  });

  it("handles unknown exceptions without code as 500", () => {
    const { host, getResult } = createMockHost();
    filter.catch("random failure", host);

    expect(getResult()).toEqual({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { error: "internal error" },
    });
  });
});
