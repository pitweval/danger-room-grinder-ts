import type { ParsedTsv } from "../types.js";

export type BehaviorSelectorKind = "type" | "tag" | "fallback";
export type BehaviorRequirementKind = "environment" | "type" | "tag";

export interface BehaviorRequirement {
  readonly kind: BehaviorRequirementKind;
  readonly value: string;
}

export interface BehaviorDefinition {
  readonly selectorKind: BehaviorSelectorKind;
  readonly selector: string;
  readonly rollMinimum: number;
  readonly rollMaximum: number;
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly requirements: readonly BehaviorRequirement[];
  readonly preferredEnvironments: readonly string[];
  readonly alertnessModifier: number | undefined;
}

export interface DispositionDefinition {
  readonly rollMinimum: number;
  readonly rollMaximum: number;
  readonly description: string;
}

export interface EncounterBehaviorCatalog {
  readonly behaviors: readonly BehaviorDefinition[];
  readonly dispositions: readonly DispositionDefinition[];
}

export interface LoadEncounterBehaviorCatalogInput {
  readonly byType: ParsedTsv;
  readonly byTag: ParsedTsv;
  readonly fallback: ParsedTsv;
  readonly dispositions: ParsedTsv;
}
