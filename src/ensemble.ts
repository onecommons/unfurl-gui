// https://app.quicktype.io?share=hS3Pzwlp1dunMZpXSINY

// To parse this data:
//
//   import { Convert, Ensemble } from "./file";
//
//   const ensemble = Convert.toEnsemble(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export interface Ensemble {
  apiVersion: any;
  changeLog?: string;
  changes?: Change[];
  context?: Context;
  jobsFolder?: string;
  kind: Kind;
  lastJob?: JobRecord;
  metadata?: Metadata;
  spec: Spec;
  status?: Status;
}

/**
 * change log entry
 */
export interface Change {
  changeId: string;
  lastConfigChange?: string;
  lastStateChange?: string;
  priority?: Priority;
  readyState?: ReadyStateObject;
  endCommit?: string;
  options?: { [key: string]: any };
  previousId?: string;
  specDigest?: string;
  startCommit?: string;
  startTime?: Date;
  summary?: string;
  workflow?: string;
  changes?: { [key: string]: { [key: string]: any } };
  dependencies?: Dependency[];
  implementation?: ImplementationDefinition;
  inputs?: { [key: string]: any };
  messages?: any[];
  result?: ResultUnion;
  target?: string;
}

export interface Dependency {
  expected?: any;
  name?: string;
  ref?: string;
  required?: boolean;
  schema?: { [key: string]: any };
}

export interface ImplementationDefinition {
  className: string;
  majorVersion?: GenericVersionIdentifier;
  minorVersion?: string;
  operation?: string;
}

export type GenericVersionIdentifier = number | string;

export enum Priority {
  Ignore = "ignore",
  Optional = "optional",
  Required = "required"
}

export interface ReadyStateObject {
  effective?: EffectiveEnum;
  local?: EffectiveEnum;
  state?: State;
}

/**
 * The operational status of the instance
 */
export enum EffectiveEnum {
  Absent = "absent",
  Degraded = "degraded",
  Error = "error",
  Ok = "ok",
  Pending = "pending",
  Unknown = "unknown"
}

/**
 * the operational state of the instance
 */
export enum State {
  Configured = "configured",
  Configuring = "configuring",
  Created = "created",
  Creating = "creating",
  Deleted = "deleted",
  Deleting = "deleting",
  Error = "error",
  Initial = "initial",
  Started = "started",
  Starting = "starting",
  Stopped = "stopped",
  Stopping = "stopping"
}

export type ResultUnion = ResultEnum | { [key: string]: any };

export enum ResultEnum {
  Skipped = "skipped"
}

export interface Context {
  connections?: { [key: string]: any };
  environment?: { [key: string]: any };
  external?: { [key: string]: External };
  inputs?: { [key: string]: any };
  locals?: External;
  runtime?: string;
  secrets?: External;
}

/**
 * Declare external instances imported from another manifest.
 */
export interface External {
  attributes?: { [key: string]: any };
  instance?: string;
  manifest?: Manifest;
  schema?: { [key: string]: any };
  uri?: string;
}

export interface Manifest {
  file?: string;
  repository?: string;
}

export enum Kind {
  Ensemble = "Ensemble",
  Manifest = "Manifest"
}

export interface JobRecord {
  changeId: string;
  lastConfigChange?: string;
  lastStateChange?: string;
  priority?: Priority;
  readyState?: ReadyStateObject;
  endCommit?: string;
  options?: { [key: string]: any };
  previousId?: string;
  specDigest?: string;
  startCommit?: string;
  startTime?: Date;
  summary?: string;
  workflow?: string;
}

export interface Metadata {
  aliases?: string[];
  uri: string;
}

export interface Spec {
  /**
   * a TOSCA service template
   */
  service_template?: { [key: string]: any };
  instances?: { [key: string]: any };
}

export interface Status {
  inputs?: { [key: string]: any };
  instances?: { [key: string]: Instance };
  outputs?: { [key: string]: any };
  topology?: string;
  lastConfigChange?: string;
  lastStateChange?: string;
  priority?: Priority;
  readyState?: ReadyStateObject;
}

export interface Instance {
  attributes?: { [key: string]: any };
  capabilities?: { [key: string]: Instance };
  imported?: string;
  instances?: { [key: string]: Instance };
  requirements?: { [key: string]: Instance };
  template?: string;
  lastConfigChange?: string;
  lastStateChange?: string;
  priority?: Priority;
  readyState?: ReadyStateObject;
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
  public static toEnsemble(json: string): Ensemble {
    return cast(JSON.parse(json), r("Ensemble"));
  }

  public static ensembleToJson(value: Ensemble): string {
    return JSON.stringify(uncast(value, r("Ensemble")), null, 2);
  }
}

function invalidValue(typ: any, val: any, key: any = ""): never {
  if (key) {
    throw Error(
      `Invalid value for key "${key}". Expected type ${JSON.stringify(
        typ
      )} but got ${JSON.stringify(val)}`
    );
  }
  throw Error(
    `Invalid value ${JSON.stringify(val)} for type ${JSON.stringify(typ)}`
  );
}

function jsonToJSProps(typ: any): any {
  if (typ.jsonToJS === undefined) {
    const map: any = {};
    typ.props.forEach((p: any) => (map[p.json] = { key: p.js, typ: p.typ }));
    typ.jsonToJS = map;
  }
  return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
  if (typ.jsToJSON === undefined) {
    const map: any = {};
    typ.props.forEach((p: any) => (map[p.js] = { key: p.json, typ: p.typ }));
    typ.jsToJSON = map;
  }
  return typ.jsToJSON;
}

function transform(val: any, typ: any, getProps: any, key: any = ""): any {
  function transformPrimitive(typ: string, val: any): any {
    if (typeof typ === typeof val) return val;
    return invalidValue(typ, val, key);
  }

  function transformUnion(typs: any[], val: any): any {
    // val must validate against one typ in typs
    const l = typs.length;
    for (let i = 0; i < l; i++) {
      const typ = typs[i];
      try {
        return transform(val, typ, getProps);
      } catch (_) {}
    }
    return invalidValue(typs, val);
  }

  function transformEnum(cases: string[], val: any): any {
    if (cases.indexOf(val) !== -1) return val;
    return invalidValue(cases, val);
  }

  function transformArray(typ: any, val: any): any {
    // val must be an array with no invalid elements
    if (!Array.isArray(val)) return invalidValue("array", val);
    return val.map(el => transform(el, typ, getProps));
  }

  function transformDate(val: any): any {
    if (val === null) {
      return null;
    }
    const d = new Date(val);
    if (isNaN(d.valueOf())) {
      return invalidValue("Date", val);
    }
    return d;
  }

  function transformObject(
    props: { [k: string]: any },
    additional: any,
    val: any
  ): any {
    if (val === null || typeof val !== "object" || Array.isArray(val)) {
      return invalidValue("object", val);
    }
    const result: any = {};
    Object.getOwnPropertyNames(props).forEach(key => {
      const prop = props[key];
      const v = Object.prototype.hasOwnProperty.call(val, key)
        ? val[key]
        : undefined;
      result[prop.key] = transform(v, prop.typ, getProps, prop.key);
    });
    Object.getOwnPropertyNames(val).forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(props, key)) {
        result[key] = transform(val[key], additional, getProps, key);
      }
    });
    return result;
  }

  if (typ === "any") return val;
  if (typ === null) {
    if (val === null) return val;
    return invalidValue(typ, val);
  }
  if (typ === false) return invalidValue(typ, val);
  while (typeof typ === "object" && typ.ref !== undefined) {
    typ = typeMap[typ.ref];
  }
  if (Array.isArray(typ)) return transformEnum(typ, val);
  if (typeof typ === "object") {
    return typ.hasOwnProperty("unionMembers")
      ? transformUnion(typ.unionMembers, val)
      : typ.hasOwnProperty("arrayItems")
      ? transformArray(typ.arrayItems, val)
      : typ.hasOwnProperty("props")
      ? transformObject(getProps(typ), typ.additional, val)
      : invalidValue(typ, val);
  }
  // Numbers can be parsed by Date but shouldn't be.
  if (typ === Date && typeof val !== "number") return transformDate(val);
  return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
  return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
  return transform(val, typ, jsToJSONProps);
}

function a(typ: any) {
  return { arrayItems: typ };
}

function u(...typs: any[]) {
  return { unionMembers: typs };
}

function o(props: any[], additional: any) {
  return { props, additional };
}

function m(additional: any) {
  return { props: [], additional };
}

function r(name: string) {
  return { ref: name };
}

const typeMap: any = {
  Ensemble: o(
    [
      { json: "apiVersion", js: "apiVersion", typ: "any" },
      { json: "changeLog", js: "changeLog", typ: u(undefined, "") },
      { json: "changes", js: "changes", typ: u(undefined, a(r("Change"))) },
      { json: "context", js: "context", typ: u(undefined, r("Context")) },
      { json: "jobsFolder", js: "jobsFolder", typ: u(undefined, "") },
      { json: "kind", js: "kind", typ: r("Kind") },
      { json: "lastJob", js: "lastJob", typ: u(undefined, r("JobRecord")) },
      { json: "metadata", js: "metadata", typ: u(undefined, r("Metadata")) },
      { json: "spec", js: "spec", typ: r("Spec") },
      { json: "status", js: "status", typ: u(undefined, r("Status")) }
    ],
    "any"
  ),
  Change: o(
    [
      { json: "changeId", js: "changeId", typ: "" },
      {
        json: "lastConfigChange",
        js: "lastConfigChange",
        typ: u(undefined, "")
      },
      { json: "lastStateChange", js: "lastStateChange", typ: u(undefined, "") },
      { json: "priority", js: "priority", typ: u(undefined, r("Priority")) },
      {
        json: "readyState",
        js: "readyState",
        typ: u(undefined, r("ReadyStateObject"))
      },
      { json: "endCommit", js: "endCommit", typ: u(undefined, "") },
      { json: "options", js: "options", typ: u(undefined, m("any")) },
      { json: "previousId", js: "previousId", typ: u(undefined, "") },
      { json: "specDigest", js: "specDigest", typ: u(undefined, "") },
      { json: "startCommit", js: "startCommit", typ: u(undefined, "") },
      { json: "startTime", js: "startTime", typ: u(undefined, Date) },
      { json: "summary", js: "summary", typ: u(undefined, "") },
      { json: "workflow", js: "workflow", typ: u(undefined, "") },
      { json: "changes", js: "changes", typ: u(undefined, m(m("any"))) },
      {
        json: "dependencies",
        js: "dependencies",
        typ: u(undefined, a(r("Dependency")))
      },
      {
        json: "implementation",
        js: "implementation",
        typ: u(undefined, r("ImplementationDefinition"))
      },
      { json: "inputs", js: "inputs", typ: u(undefined, m("any")) },
      { json: "messages", js: "messages", typ: u(undefined, a("any")) },
      {
        json: "result",
        js: "result",
        typ: u(undefined, u(r("ResultEnum"), m("any")))
      },
      { json: "target", js: "target", typ: u(undefined, "") }
    ],
    "any"
  ),
  Dependency: o(
    [
      { json: "expected", js: "expected", typ: u(undefined, "any") },
      { json: "name", js: "name", typ: u(undefined, "") },
      { json: "ref", js: "ref", typ: u(undefined, "") },
      { json: "required", js: "required", typ: u(undefined, true) },
      { json: "schema", js: "schema", typ: u(undefined, m("any")) }
    ],
    "any"
  ),
  ImplementationDefinition: o(
    [
      { json: "className", js: "className", typ: "" },
      {
        json: "majorVersion",
        js: "majorVersion",
        typ: u(undefined, u(3.14, ""))
      },
      { json: "minorVersion", js: "minorVersion", typ: u(undefined, "") },
      { json: "operation", js: "operation", typ: u(undefined, "") }
    ],
    "any"
  ),
  ReadyStateObject: o(
    [
      {
        json: "effective",
        js: "effective",
        typ: u(undefined, r("EffectiveEnum"))
      },
      { json: "local", js: "local", typ: u(undefined, r("EffectiveEnum")) },
      { json: "state", js: "state", typ: u(undefined, r("State")) }
    ],
    "any"
  ),
  Context: o(
    [
      { json: "connections", js: "connections", typ: u(undefined, m("any")) },
      { json: "environment", js: "environment", typ: u(undefined, m("any")) },
      { json: "external", js: "external", typ: u(undefined, m(r("External"))) },
      { json: "inputs", js: "inputs", typ: u(undefined, m("any")) },
      { json: "locals", js: "locals", typ: u(undefined, r("External")) },
      { json: "runtime", js: "runtime", typ: u(undefined, "") },
      { json: "secrets", js: "secrets", typ: u(undefined, r("External")) }
    ],
    "any"
  ),
  External: o(
    [
      { json: "attributes", js: "attributes", typ: u(undefined, m("any")) },
      { json: "instance", js: "instance", typ: u(undefined, "") },
      { json: "manifest", js: "manifest", typ: u(undefined, r("Manifest")) },
      { json: "schema", js: "schema", typ: u(undefined, m("any")) },
      { json: "uri", js: "uri", typ: u(undefined, "") }
    ],
    "any"
  ),
  Manifest: o(
    [
      { json: "file", js: "file", typ: u(undefined, "") },
      { json: "repository", js: "repository", typ: u(undefined, "") }
    ],
    "any"
  ),
  JobRecord: o(
    [
      { json: "changeId", js: "changeId", typ: "" },
      {
        json: "lastConfigChange",
        js: "lastConfigChange",
        typ: u(undefined, "")
      },
      { json: "lastStateChange", js: "lastStateChange", typ: u(undefined, "") },
      { json: "priority", js: "priority", typ: u(undefined, r("Priority")) },
      {
        json: "readyState",
        js: "readyState",
        typ: u(undefined, r("ReadyStateObject"))
      },
      { json: "endCommit", js: "endCommit", typ: u(undefined, "") },
      { json: "options", js: "options", typ: u(undefined, m("any")) },
      { json: "previousId", js: "previousId", typ: u(undefined, "") },
      { json: "specDigest", js: "specDigest", typ: u(undefined, "") },
      { json: "startCommit", js: "startCommit", typ: u(undefined, "") },
      { json: "startTime", js: "startTime", typ: u(undefined, Date) },
      { json: "summary", js: "summary", typ: u(undefined, "") },
      { json: "workflow", js: "workflow", typ: u(undefined, "") }
    ],
    "any"
  ),
  Metadata: o(
    [
      { json: "aliases", js: "aliases", typ: u(undefined, a("")) },
      { json: "uri", js: "uri", typ: "" }
    ],
    "any"
  ),
  Spec: o(
    [
      {
        json: "service_template",
        js: "service_template",
        typ: u(undefined, m("any"))
      },
      { json: "instances", js: "instances", typ: u(undefined, m("any")) }
    ],
    "any"
  ),
  Status: o(
    [
      { json: "inputs", js: "inputs", typ: u(undefined, m("any")) },
      {
        json: "instances",
        js: "instances",
        typ: u(undefined, m(r("Instance")))
      },
      { json: "outputs", js: "outputs", typ: u(undefined, m("any")) },
      { json: "topology", js: "topology", typ: u(undefined, "") },
      {
        json: "lastConfigChange",
        js: "lastConfigChange",
        typ: u(undefined, "")
      },
      { json: "lastStateChange", js: "lastStateChange", typ: u(undefined, "") },
      { json: "priority", js: "priority", typ: u(undefined, r("Priority")) },
      {
        json: "readyState",
        js: "readyState",
        typ: u(undefined, r("ReadyStateObject"))
      }
    ],
    "any"
  ),
  Instance: o(
    [
      { json: "attributes", js: "attributes", typ: u(undefined, m("any")) },
      {
        json: "capabilities",
        js: "capabilities",
        typ: u(undefined, m(r("Instance")))
      },
      { json: "imported", js: "imported", typ: u(undefined, "") },
      {
        json: "instances",
        js: "instances",
        typ: u(undefined, m(r("Instance")))
      },
      {
        json: "requirements",
        js: "requirements",
        typ: u(undefined, m(r("Instance")))
      },
      { json: "template", js: "template", typ: u(undefined, "") },
      {
        json: "lastConfigChange",
        js: "lastConfigChange",
        typ: u(undefined, "")
      },
      { json: "lastStateChange", js: "lastStateChange", typ: u(undefined, "") },
      { json: "priority", js: "priority", typ: u(undefined, r("Priority")) },
      {
        json: "readyState",
        js: "readyState",
        typ: u(undefined, r("ReadyStateObject"))
      }
    ],
    "any"
  ),
  Priority: ["ignore", "optional", "required"],
  EffectiveEnum: ["absent", "degraded", "error", "ok", "pending", "unknown"],
  State: [
    "configured",
    "configuring",
    "created",
    "creating",
    "deleted",
    "deleting",
    "error",
    "initial",
    "started",
    "starting",
    "stopped",
    "stopping"
  ],
  ResultEnum: ["skipped"],
  Kind: ["Ensemble", "Manifest"]
};
