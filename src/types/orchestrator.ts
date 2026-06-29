// DTOs derived from UiPath Orchestrator API v20.0 swagger

export interface FolderDto {
  Id: number;
  Key?: string;
  DisplayName: string;
  FullyQualifiedName: string;
  Description?: string;
  ParentId?: number;
  ParentKey?: string;
  FolderType?: string;
  ProvisionType?: string;
  PermissionModel?: string;
}

export interface UserDto {
  Id: number;
  UserName: string;
  FullName?: string;
  EmailAddress?: string;
  IsActive?: boolean;
  IsEmailConfirmed?: boolean;
  MayHaveRobotSession?: boolean;
  MayHaveUnattended?: boolean;
  Type?: string;
  Roles?: RoleDto[];
}

export interface RoleDto {
  Id: number;
  Name: string;
  DisplayName?: string;
  IsStatic?: boolean;
  IsEditable?: boolean;
}

export interface MachineDto {
  Id: number;
  Name: string;
  Description?: string;
  Type?: string; // "Template" | "Standard"
  LicenseKey?: string;
  NonProductionSlots?: number;
  UnattendedSlots?: number;
}

export interface MachineSessionDto {
  MachineId: number;
  MachineName?: string;
  HostMachineName?: string;
  State?: string;
  ReportingTime?: string;
  RobotUserName?: string;
  SessionId?: number;
}

export interface ProcessDto {
  // odata/Processes (packages)
  Id: string;
  Title?: string;
  Version?: string;
  IsLatestVersion?: boolean;
  Published?: string;
  Description?: string;
  Authors?: string;
}

export interface ReleaseDto {
  Id: number;
  Key?: string;
  Name: string;
  Description?: string;
  ProcessVersion?: string;
  IsLatestVersion?: boolean;
  IsProcessDeleted?: boolean;
  IsAttended?: boolean;
  ReleaseName?: string;
  EnvironmentName?: string;
}

export interface JobDto {
  Id: number;
  Key?: string;
  ReleaseName?: string;
  State?: string;
  Source?: string;
  StartTime?: string;
  EndTime?: string;
  CreationTime?: string;
  Machine?: string;
  HostMachineName?: string;
  Info?: string;
  InputArguments?: string;
  OutputArguments?: string;
  RobotName?: string;
}

export interface ProcessScheduleDto {
  Id: number;
  Name: string;
  ReleaseName?: string;
  Description?: string;
  StartProcessCron?: string;
  TimeZoneIana?: string;
  QueueDefinitionName?: string;
  Enabled?: boolean;
  SpecificPriorityValue?: number;
  MachineRobots?: Array<{
    MachineName?: string;
    SessionName?: string;
    RobotUserName?: string;
  }>;
}

export interface UserRolesDto {
  UserEntity: UserDto;
  Roles: RoleDto[];
}

export interface FolderAssignmentsDto {
  FolderName?: string;
  FolderId?: number;
  FolderFullyQualifiedName?: string;
  Roles?: RoleDto[];
}

export interface AssetDto {
  Id: number;
  Name: string;
  ValueType?: string; // "Text" | "Integer" | "Bool" | "Credential" | "DBConnectionString" | "HttpConnectionString"
  StringValue?: string;
  BoolValue?: boolean;
  IntValue?: number;
  Value?: string;
  Description?: string;
}

export interface UserAssetValueDto {
  Name: string;
  ValueType?: string;
  StringValue?: string;
  BoolValue?: boolean;
  IntValue?: number;
}

export interface QueueDefinitionDto {
  Id: number;
  Name: string;
  Description?: string;
  MaxNumberOfRetries?: number;
  AcceptAutomaticallyRetry?: boolean;
  EnforceUniqueReference?: boolean;
  ProcessingType?: string;
}

export interface QueueItemDto {
  Id: number;
  Key?: string;
  Reference?: string;
  Priority?: string;
  Status?: string;
  ReviewStatus?: string;
  DeferDate?: string;
  DueDate?: string;
  StartProcessing?: string;
  EndProcessing?: string;
  CreationTime?: string;
  Progress?: string;
  ProcessingExceptionType?: string;
  SpecificData?: string;
  Output?: string;
  RetryNumber?: number;
}

export interface AddQueueItemRequest {
  itemData: {
    Priority: "Low" | "Normal" | "High";
    Name: string;
    SpecificContent?: Record<string, unknown>;
    Reference?: string;
    DeferDate?: string;
    DueDate?: string;
  };
}

export interface BulkAddQueueItemsRequest {
  queueName: string;
  commitType?: "AllOrNothing" | "ProcessAllIndependently";
  queueItems: Array<{
    Priority: "Low" | "Normal" | "High";
    SpecificContent?: Record<string, unknown>;
    Reference?: string;
    DeferDate?: string;
    DueDate?: string;
  }>;
}

export interface AlertDto {
  Id: number;
  NotificationName?: string;
  Data?: string;
  Component?: string;
  Severity?: string;
  State?: string;
  DeepLink?: string;
  CreationTime?: string;
}

export interface LogDto {
  Id: number;
  Level?: string;
  Message?: string;
  TimeStamp?: string;
  ProcessName?: string;
  JobKey?: string;
  RobotName?: string;
  MachineId?: number;
  MachineName?: string;
}

export interface JobsStatsDto {
  Successful?: number;
  Faulted?: number;
  Canceled?: number;
  Pending?: number;
  Running?: number;
  Total?: number;
}

export interface StartJobsRequest {
  startInfo: {
    ReleaseKey: string;
    Strategy: "ModernJobsCount";
    MachineRobots: Array<{ MachineId: number; RobotId: number }>;
    MachineSessionIds?: number[];
  };
}

export interface FolderAssignUsersRequest {
  assignments: {
    UserIds: number[];
    RolesPerFolder: Array<{ FolderId: number; RoleIds: number[] }>;
  };
}

export interface FolderAssignMachinesRequest {
  assignments: {
    MachineIds: number[];
    FolderIds: number[];
  };
}

export interface ODataResponse<T> {
  "@odata.count"?: number;
  value: T[];
}

export interface RobotDto {
  Id: number;
  Name: string;
  MachineName?: string;
  MachineId?: number;
  Username?: string;
  Type?: string; // "Unattended" | "Attended" | "NonProduction" | "Studio"
  Description?: string;
  LicenseKey?: string;
  IsEnabled?: boolean;
  ExecutionSettings?: Record<string, unknown>;
}

export interface SessionDto {
  MachineId?: number;
  MachineName?: string;
  HostMachineName?: string;
  State?: string;
  ReportingTime?: string;
  RuntimeType?: string;
  RobotUserName?: string;
  SessionId?: number;
  IsUnresponsive?: boolean;
}

export interface WebhookEventDto {
  EventType?: string;
}

export interface WebhookDto {
  Id: number;
  Name?: string;
  Url: string;
  Enabled?: boolean;
  Secret?: string;
  AllowInsecureSsl?: boolean;
  SubscribeToAllEvents?: boolean;
  Events?: WebhookEventDto[];
}

export interface AuditLogDto {
  Id: number;
  UserName?: string;
  Action?: string;
  OperationText?: string;
  EntityId?: string;
  EntityType?: string;
  TimeStamp?: string;
  ServiceName?: string;
  Component?: string;
}

export interface ReleaseExtendedDto extends ReleaseDto {
  ProcessKey?: string;
  EntryPointId?: number;
  EntryPointPath?: string;
  AutoUpdate?: boolean;
  CurrentVersion?: string;
  Arguments?: {
    Input?: string;
    Output?: string;
  };
}
