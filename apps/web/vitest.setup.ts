import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
// server-only throws when imported outside RSC; stub it for unit tests.
vi.mock("server-only", () => ({}));
