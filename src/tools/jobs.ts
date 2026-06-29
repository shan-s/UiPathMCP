import { z } from "zod";
import { odataClient, resolveFolderId, folderHeader } from "../client.js";
import type { ODataResponse, JobDto, StartJobsRequest } from "../types/orchestrator.js";

export const jobTools = [
  {
    name: "get_jobs_in_folder",
    description:
      "Gets the 50 most recent jobs in a folder, ordered by start time descending.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
    }),
    async handler({ folderName }: { folderName: string }) {
      const folderId = await resolveFolderId(folderName);
      const res = await odataClient.get<ODataResponse<JobDto>>("Jobs", {
        params: { $top: 500, $orderby: "StartTime desc" },
        ...folderHeader(folderId),
      });
      return res.data.value.slice(0, 50).map((j) => ({
        id: j.Id,
        key: j.Key,
        processName: j.ReleaseName,
        state: j.State,
        startTime: j.StartTime,
        endTime: j.EndTime,
        machine: j.Machine,
        hostMachineName: j.HostMachineName,
        robotName: j.RobotName,
      }));
    },
  },

  {
    name: "get_job_details",
    description: "Gets full details of a specific job by its numeric ID.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      jobId: z.number().describe("Job ID"),
    }),
    async handler({ folderName, jobId }: { folderName: string; jobId: number }) {
      const folderId = await resolveFolderId(folderName);
      const res = await odataClient.get<JobDto>(`Jobs(${jobId})`, folderHeader(folderId));
      const j = res.data;
      return {
        id: j.Id,
        key: j.Key,
        processName: j.ReleaseName,
        state: j.State,
        source: j.Source,
        startTime: j.StartTime,
        endTime: j.EndTime,
        machine: j.Machine,
        hostMachineName: j.HostMachineName,
        robotName: j.RobotName,
        info: j.Info,
        inputArguments: j.InputArguments,
        outputArguments: j.OutputArguments,
      };
    },
  },

  {
    name: "execute_process",
    description:
      "Starts a process (job) in a folder. Requires the release key, machine group ID, and robot user ID. Host machine ID is optional to pin to a specific VM.",
    inputSchema: z.object({
      folderId: z.number().describe("Folder ID"),
      releaseKey: z.string().describe("Release key of the process (from get_process_details)"),
      machineGroupId: z.number().describe("Machine group (template) ID"),
      robotUserId: z.number().describe("Robot user ID"),
      hostMachineSessionId: z
        .number()
        .optional()
        .describe("Optional host machine session ID to pin execution to a specific VM"),
    }),
    async handler({
      folderId,
      releaseKey,
      machineGroupId,
      robotUserId,
      hostMachineSessionId,
    }: {
      folderId: number;
      releaseKey: string;
      machineGroupId: number;
      robotUserId: number;
      hostMachineSessionId?: number;
    }) {
      const body: StartJobsRequest = {
        startInfo: {
          ReleaseKey: releaseKey,
          Strategy: "ModernJobsCount",
          MachineRobots: [{ MachineId: machineGroupId, RobotId: robotUserId }],
          MachineSessionIds: hostMachineSessionId ? [hostMachineSessionId] : undefined,
        },
      };
      const res = await odataClient.post<ODataResponse<JobDto>>(
        "Jobs/UiPath.Server.Configuration.OData.StartJobs",
        body,
        folderHeader(folderId)
      );
      const job = res.data.value[0];
      return {
        id: job.Id,
        key: job.Key,
        processName: job.ReleaseName,
        state: job.State,
        startTime: job.StartTime,
      };
    },
  },

  {
    name: "stop_job",
    description: "Stops a running job. Strategy can be 'SoftStop' (finish current transaction) or 'Kill' (immediate).",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      jobId: z.number().describe("Job ID to stop"),
      strategy: z
        .enum(["SoftStop", "Kill"])
        .default("SoftStop")
        .describe("Stop strategy"),
    }),
    async handler({
      folderName,
      jobId,
      strategy,
    }: {
      folderName: string;
      jobId: number;
      strategy: "SoftStop" | "Kill";
    }) {
      const folderId = await resolveFolderId(folderName);
      await odataClient.post(
        `Jobs(${jobId})/UiPath.Server.Configuration.OData.StopJob`,
        { strategy },
        folderHeader(folderId)
      );
      return { success: true, jobId, strategy };
    },
  },

  {
    name: "restart_job",
    description: "Restarts a faulted or stopped job.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      jobId: z.number().describe("Job ID to restart"),
    }),
    async handler({ folderName, jobId }: { folderName: string; jobId: number }) {
      const folderId = await resolveFolderId(folderName);
      await odataClient.post(
        "Jobs/UiPath.Server.Configuration.OData.RestartJob",
        { jobId },
        folderHeader(folderId)
      );
      return { success: true, jobId };
    },
  },

  {
    name: "resume_job",
    description: "Resumes a paused job.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      jobId: z.number().describe("Job ID to resume"),
    }),
    async handler({ folderName, jobId }: { folderName: string; jobId: number }) {
      const folderId = await resolveFolderId(folderName);
      await odataClient.post(
        `Jobs(${jobId})/UiPath.Server.Configuration.OData.ResumeJob`,
        {},
        folderHeader(folderId)
      );
      return { success: true, jobId };
    },
  },

  {
    name: "bulk_stop_jobs",
    description: "Stops multiple jobs at once using either SoftStop or Kill strategy.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      jobIds: z.array(z.number()).describe("Array of job IDs to stop"),
      strategy: z
        .enum(["SoftStop", "Kill"])
        .default("SoftStop")
        .describe("Stop strategy: SoftStop finishes the current transaction, Kill terminates immediately"),
    }),
    async handler({
      folderName,
      jobIds,
      strategy,
    }: {
      folderName: string;
      jobIds: number[];
      strategy: "SoftStop" | "Kill";
    }) {
      const folderId = await resolveFolderId(folderName);
      await odataClient.post(
        "Jobs/UiPath.Server.Configuration.OData.StopJobs",
        { jobIds, strategy },
        folderHeader(folderId)
      );
      return { success: true, jobIds, strategy };
    },
  },
] as const;
