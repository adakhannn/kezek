export type WorkflowErrorType = 'auth' | 'forbidden' | 'internal' | 'not_found' | 'validation';

export type WorkflowError = {
    message: string;
    statusCode: number;
    type: WorkflowErrorType;
};

export type ShiftItemsWorkflowMeta = {
    bizId?: string;
    staffId?: string;
    userId?: string;
};

export type ShiftItemsWorkflowSuccess = {
    bizId: string;
    businessTz: string;
    percentMaster: number;
    percentSalon: number;
    shiftId: string;
    staffId: string;
    supabase: any;
    useServiceClient: boolean;
    userId?: string;
};
