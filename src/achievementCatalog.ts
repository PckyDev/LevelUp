import {
  AchievementAllOfTrackingDefinition,
  AchievementDefinition,
  AchievementMetricType,
  AchievementRatioTrackingDefinition,
  AchievementThresholdTrackingDefinition,
  AchievementTrackingConditionDefinition,
  AchievementTrackingDefinition,
} from './types';

const achievementCatalog = require('../data/achievements.json') as unknown;

const METRIC_TYPES = new Set<AchievementMetricType>([
  'activeDays',
  'currentStreak',
  'languagesUsed',
  'level',
  'longestStreak',
  'totalEdits',
  'totalSaves',
  'totalTypedCharacters',
  'totalXp',
]);

interface AchievementSeriesDefinition {
  idPrefix: string;
  titlePrefix: string;
  icon: string;
  descriptionTemplate: string;
  tracking: AchievementSeriesTrackingDefinition;
  tiers: number[];
}

type AchievementSeriesTrackingDefinition =
  | Omit<AchievementThresholdTrackingDefinition, 'target'>
  | Omit<AchievementRatioTrackingDefinition, 'target'>;

export function loadAchievementDefinitions(): readonly AchievementDefinition[] {
  const definitions = parseAchievementCatalog(achievementCatalog);
  return definitions.map(cloneAchievementDefinition);
}

function parseAchievementCatalog(raw: unknown): AchievementDefinition[] {
  const record = asRecord(raw, 'achievement catalog');

  const seenIds = new Set<string>();

  return [
    ...parseAchievementSeriesList(record.series, seenIds),
    ...parseAchievementDefinitionList(record.achievements, seenIds),
  ];
}

function parseAchievementSeriesList(
  raw: unknown,
  seenIds: Set<string>,
): AchievementDefinition[] {
  if (raw === undefined) {
    return [];
  }

  if (!Array.isArray(raw)) {
    throw new Error('Achievement series must be an array.');
  }

  return raw.flatMap((entry, index) => expandAchievementSeries(parseAchievementSeries(entry, index), seenIds));
}

function parseAchievementDefinitionList(
  raw: unknown,
  seenIds: Set<string>,
): AchievementDefinition[] {
  if (raw === undefined) {
    return [];
  }

  if (!Array.isArray(raw)) {
    throw new Error('Explicit achievements must be an array.');
  }

  return raw.map((entry, index) => {
    const definition = parseAchievementDefinition(entry, `achievement at index ${index}`);
    assertUniqueId(definition.id, seenIds);
    return definition;
  });
}

function parseAchievementSeries(raw: unknown, index: number): AchievementSeriesDefinition {
  const record = asRecord(raw, `achievement series at index ${index}`);

  return {
    idPrefix: readRequiredString(record.idPrefix, `series idPrefix at index ${index}`),
    titlePrefix: readRequiredString(record.titlePrefix, `series titlePrefix at index ${index}`),
    icon: readRequiredString(record.icon, `series icon at index ${index}`),
    descriptionTemplate: readRequiredString(
      record.descriptionTemplate,
      `series descriptionTemplate at index ${index}`,
    ),
    tracking: parseAchievementSeriesTracking(record.tracking, index),
    tiers: parseSeriesTiers(record.tiers, index),
  };
}

function expandAchievementSeries(
  series: AchievementSeriesDefinition,
  seenIds: Set<string>,
): AchievementDefinition[] {
  return series.tiers.map((target, index) => {
    const rank = toRomanNumeral(index + 1);
    const definition: AchievementDefinition = {
      id: `${series.idPrefix}-${index + 1}`,
      title: `${series.titlePrefix} ${rank}`,
      description: renderSeriesDescription(series.descriptionTemplate, target, rank, series.tracking),
      icon: series.icon,
      group: {
        id: series.idPrefix,
        title: series.titlePrefix,
        tierIndex: index,
        tierCount: series.tiers.length,
        tierLabel: rank,
      },
      tracking: materializeSeriesTracking(series.tracking, target),
    };

    assertUniqueId(definition.id, seenIds);
    return definition;
  });
}

function parseAchievementDefinition(raw: unknown, label: string): AchievementDefinition {
  const record = asRecord(raw, label);
  const id = readRequiredString(record.id, `${label} id`);
  const title = readRequiredString(record.title, `${label} title`);

  return {
    id,
    title,
    description: readRequiredString(record.description, `${label} description`),
    icon: readRequiredString(record.icon, `${label} icon`),
    group: {
      id,
      title,
      tierIndex: 0,
      tierCount: 1,
    },
    tracking: parseTrackingDefinition(record.tracking, `${label} tracking`),
  };
}

function parseAchievementSeriesTracking(
  raw: unknown,
  index: number,
): AchievementSeriesTrackingDefinition {
  const record = asRecord(raw, `tracking config for series at index ${index}`);
  const mode = readRequiredString(record.mode, `series tracking mode at index ${index}`);

  switch (mode) {
    case 'threshold':
      return parseSeriesThresholdTracking(record, `series at index ${index}`);
    case 'ratio':
      return parseSeriesRatioTracking(record, `series at index ${index}`);
    default:
      throw new Error(`Unsupported series tracking mode: ${mode}`);
  }
}

function parseTrackingDefinition(raw: unknown, label: string): AchievementTrackingDefinition {
  const record = asRecord(raw, label);
  const mode = readRequiredString(record.mode, `${label} mode`);

  switch (mode) {
    case 'threshold':
      return parseThresholdTracking(record, label);
    case 'ratio':
      return parseRatioTracking(record, label);
    case 'allOf':
      return parseAllOfTracking(record, label);
    default:
      throw new Error(`Unsupported tracking mode: ${mode}`);
  }
}

function parseSeriesThresholdTracking(
  record: Record<string, unknown>,
  label: string,
): Omit<AchievementThresholdTrackingDefinition, 'target'> {
  return {
    mode: 'threshold',
    metric: readMetricType(record.metric, `${label} metric`),
    unit: readRequiredString(record.unit, `${label} unit`),
    precision: readOptionalPrecision(record.precision, `${label} precision`),
  };
}

function parseSeriesRatioTracking(
  record: Record<string, unknown>,
  label: string,
): Omit<AchievementRatioTrackingDefinition, 'target'> {
  return {
    mode: 'ratio',
    numerator: readMetricType(record.numerator, `${label} numerator`),
    denominator: readMetricType(record.denominator, `${label} denominator`),
    unit: readRequiredString(record.unit, `${label} unit`),
    multiplier: readOptionalPositiveNumber(record.multiplier, `${label} multiplier`),
    precision: readOptionalPrecision(record.precision, `${label} precision`),
    minDenominator: readOptionalPositiveNumber(record.minDenominator, `${label} minDenominator`),
  };
}

function parseThresholdTracking(
  record: Record<string, unknown>,
  label: string,
): AchievementThresholdTrackingDefinition {
  return {
    ...parseSeriesThresholdTracking(record, label),
    target: readPositiveNumber(record.target, `${label} target`),
  };
}

function parseRatioTracking(
  record: Record<string, unknown>,
  label: string,
): AchievementRatioTrackingDefinition {
  return {
    ...parseSeriesRatioTracking(record, label),
    target: readPositiveNumber(record.target, `${label} target`),
  };
}

function parseAllOfTracking(
  record: Record<string, unknown>,
  label: string,
): AchievementAllOfTrackingDefinition {
  if (!Array.isArray(record.conditions) || record.conditions.length === 0) {
    throw new Error(`Invalid ${label} conditions.`);
  }

  return {
    mode: 'allOf',
    conditions: record.conditions.map((condition, index) =>
      parseTrackingCondition(condition, `${label} condition at index ${index}`),
    ),
    label: readOptionalString(record.label),
  };
}

function parseTrackingCondition(
  raw: unknown,
  label: string,
): AchievementTrackingConditionDefinition {
  const record = asRecord(raw, label);
  const mode = readRequiredString(record.mode, `${label} mode`);

  switch (mode) {
    case 'threshold':
      return parseThresholdTracking(record, label);
    case 'ratio':
      return parseRatioTracking(record, label);
    default:
      throw new Error(`Unsupported condition mode: ${mode}`);
  }
}

function parseSeriesTiers(raw: unknown, index: number): number[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`Achievement series at index ${index} must define at least one tier.`);
  }

  return raw.map((target, tierIndex) =>
    readPositiveNumber(target, `series tier ${tierIndex} at index ${index}`),
  );
}

function materializeSeriesTracking(
  tracking: AchievementSeriesTrackingDefinition,
  target: number,
): AchievementTrackingDefinition {
  return {
    ...tracking,
    target,
  };
}

function renderSeriesDescription(
  template: string,
  target: number,
  rank: string,
  tracking: AchievementSeriesTrackingDefinition,
): string {
  return template
    .replace(/\{target\}/g, formatTarget(target, tracking))
    .replace(/\{rank\}/g, rank);
}

function formatTarget(
  target: number,
  tracking: AchievementSeriesTrackingDefinition,
): string {
  const precision = tracking.precision ?? 0;
  return target.toLocaleString('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

function assertUniqueId(id: string, seenIds: Set<string>): void {
  if (seenIds.has(id)) {
    throw new Error(`Achievement catalog contains a duplicate id: ${id}`);
  }

  seenIds.add(id);
}

function cloneAchievementDefinition(definition: AchievementDefinition): AchievementDefinition {
  return {
    ...definition,
    group: {
      ...definition.group,
    },
    tracking: cloneTrackingDefinition(definition.tracking),
  };
}

function cloneTrackingDefinition(
  tracking: AchievementTrackingDefinition,
): AchievementTrackingDefinition {
  switch (tracking.mode) {
    case 'threshold':
      return { ...tracking };
    case 'ratio':
      return { ...tracking };
    case 'allOf':
      return {
        ...tracking,
        conditions: tracking.conditions.map((condition) => ({ ...condition })),
      };
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid ${label}.`);
  }

  return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${label}.`);
  }

  return value.trim();
}

function readPositiveNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${label}.`);
  }

  return value;
}

function readMetricType(value: unknown, label: string): AchievementMetricType {
  const metric = readRequiredString(value, label);

  if (!METRIC_TYPES.has(metric as AchievementMetricType)) {
    throw new Error(`Unsupported metric type: ${metric}`);
  }

  return metric as AchievementMetricType;
}

function readOptionalPositiveNumber(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readPositiveNumber(value, label);
}

function readOptionalPrecision(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${label}.`);
  }

  return value;
}

function readOptionalString(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Invalid optional string value.');
  }

  return value.trim();
}

function toRomanNumeral(value: number): string {
  const numerals: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];

  let remaining = Math.max(1, Math.floor(value));
  let result = '';

  for (const [amount, numeral] of numerals) {
    while (remaining >= amount) {
      result += numeral;
      remaining -= amount;
    }
  }

  return result;
}