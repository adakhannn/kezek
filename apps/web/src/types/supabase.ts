export type Json = string | number | boolean | null | {
    [key: string]: Json | undefined;
} | Json[];
export type Database = {
    "public": {
        Tables: {
            "account_deletion_requests": {
                Row: {
                    "blocker_snapshot": NonNullable<Json>;
                    "cancelled_at": string | null;
                    "completed_at": string | null;
                    "created_at": string;
                    "preference_snapshot": NonNullable<Json>;
                    "requested_at": string;
                    "scheduled_for": string;
                    "status": string;
                    "updated_at": string;
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "blocker_snapshot"?: NonNullable<Json>;
                    "cancelled_at"?: string | null;
                    "completed_at"?: string | null;
                    "created_at"?: string;
                    "preference_snapshot"?: NonNullable<Json>;
                    "requested_at"?: string;
                    "scheduled_for": string;
                    "status"?: string;
                    "updated_at"?: string;
                    "user_id": string;
                };
                Update: {
                    "blocker_snapshot"?: NonNullable<Json>;
                    "cancelled_at"?: string | null;
                    "completed_at"?: string | null;
                    "created_at"?: string;
                    "preference_snapshot"?: NonNullable<Json>;
                    "requested_at"?: string;
                    "scheduled_for"?: string;
                    "status"?: string;
                    "updated_at"?: string;
                    "user_id"?: string;
                };
                Relationships: [
                ];
            };
            "analytics_events": {
                Row: {
                    "biz_id": string | null;
                    "booking_id": string | null;
                    "branch_id": string | null;
                    "client_id": string | null;
                    "created_at": string;
                    "event_type": string;
                    "id": string;
                    "metadata": NonNullable<Json>;
                    "session_id": string | null;
                    "source": string;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id"?: string | null;
                    "booking_id"?: string | null;
                    "branch_id"?: string | null;
                    "client_id"?: string | null;
                    "created_at"?: string;
                    "event_type": string;
                    "id"?: string;
                    "metadata"?: NonNullable<Json>;
                    "session_id"?: string | null;
                    "source": string;
                };
                Update: {
                    "biz_id"?: string | null;
                    "booking_id"?: string | null;
                    "branch_id"?: string | null;
                    "client_id"?: string | null;
                    "created_at"?: string;
                    "event_type"?: string;
                    "id"?: string;
                    "metadata"?: NonNullable<Json>;
                    "session_id"?: string | null;
                    "source"?: string;
                };
                Relationships: [
                ];
            };
            "api_request_metrics": {
                Row: {
                    "biz_id": string | null;
                    "created_at": string;
                    "duration_ms": number;
                    "endpoint": string;
                    "error_message": string | null;
                    "error_type": string | null;
                    "id": string;
                    "ip_address": unknown;
                    "metadata": Json | null;
                    "method": string;
                    "request_size_bytes": number | null;
                    "response_size_bytes": number | null;
                    "staff_id": string | null;
                    "status_code": number;
                    "user_agent": string | null;
                    "user_id": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id"?: string | null;
                    "created_at"?: string;
                    "duration_ms": number;
                    "endpoint": string;
                    "error_message"?: string | null;
                    "error_type"?: string | null;
                    "id"?: string;
                    "ip_address"?: unknown;
                    "metadata"?: Json | null;
                    "method"?: string;
                    "request_size_bytes"?: number | null;
                    "response_size_bytes"?: number | null;
                    "staff_id"?: string | null;
                    "status_code": number;
                    "user_agent"?: string | null;
                    "user_id"?: string | null;
                };
                Update: {
                    "biz_id"?: string | null;
                    "created_at"?: string;
                    "duration_ms"?: number;
                    "endpoint"?: string;
                    "error_message"?: string | null;
                    "error_type"?: string | null;
                    "id"?: string;
                    "ip_address"?: unknown;
                    "metadata"?: Json | null;
                    "method"?: string;
                    "request_size_bytes"?: number | null;
                    "response_size_bytes"?: number | null;
                    "staff_id"?: string | null;
                    "status_code"?: number;
                    "user_agent"?: string | null;
                    "user_id"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "api_request_metrics_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "api_request_metrics_staff_id_fkey";
                        columns: [
                            "staff_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "staff";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "api_request_metrics_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "application_moderation_actions": {
                Row: {
                    "action": string;
                    "actor_user_id": string | null;
                    "application_id": string;
                    "application_kind": string;
                    "biz_id": string | null;
                    "blocked_until": string | null;
                    "created_at": string;
                    "id": string;
                    "metadata": NonNullable<Json>;
                    "reason": string | null;
                    "target_user_id": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "action": string;
                    "actor_user_id"?: string | null;
                    "application_id": string;
                    "application_kind": string;
                    "biz_id"?: string | null;
                    "blocked_until"?: string | null;
                    "created_at"?: string;
                    "id"?: string;
                    "metadata"?: NonNullable<Json>;
                    "reason"?: string | null;
                    "target_user_id"?: string | null;
                };
                Update: {
                    "action"?: string;
                    "actor_user_id"?: string | null;
                    "application_id"?: string;
                    "application_kind"?: string;
                    "biz_id"?: string | null;
                    "blocked_until"?: string | null;
                    "created_at"?: string;
                    "id"?: string;
                    "metadata"?: NonNullable<Json>;
                    "reason"?: string | null;
                    "target_user_id"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "application_moderation_actions_actor_user_id_fkey";
                        columns: [
                            "actor_user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "application_moderation_actions_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "application_moderation_actions_target_user_id_fkey";
                        columns: [
                            "target_user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "application_submission_blocks": {
                Row: {
                    "application_kind": string;
                    "biz_id": string | null;
                    "blocked_until": string;
                    "created_at": string;
                    "created_by": string | null;
                    "id": string;
                    "reason": string | null;
                    "released_at": string | null;
                    "released_by": string | null;
                    "subject_phone": string | null;
                    "subject_user_id": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "application_kind": string;
                    "biz_id"?: string | null;
                    "blocked_until": string;
                    "created_at"?: string;
                    "created_by"?: string | null;
                    "id"?: string;
                    "reason"?: string | null;
                    "released_at"?: string | null;
                    "released_by"?: string | null;
                    "subject_phone"?: string | null;
                    "subject_user_id"?: string | null;
                };
                Update: {
                    "application_kind"?: string;
                    "biz_id"?: string | null;
                    "blocked_until"?: string;
                    "created_at"?: string;
                    "created_by"?: string | null;
                    "id"?: string;
                    "reason"?: string | null;
                    "released_at"?: string | null;
                    "released_by"?: string | null;
                    "subject_phone"?: string | null;
                    "subject_user_id"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "application_submission_blocks_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "application_submission_blocks_created_by_fkey";
                        columns: [
                            "created_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "application_submission_blocks_released_by_fkey";
                        columns: [
                            "released_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "application_submission_blocks_subject_user_id_fkey";
                        columns: [
                            "subject_user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "biz_day_metrics": {
                Row: {
                    "avg_branch_score": number | null;
                    "avg_rating": number | null;
                    "biz_id": string;
                    "created_at": string;
                    "day_score": number | null;
                    "id": string;
                    "metric_date": string;
                    "total_clients_count": number;
                    "total_revenue": number;
                    "total_reviews_count": number;
                    "updated_at": string;
                };
                ComputedFields: never;
                Insert: {
                    "avg_branch_score"?: number | null;
                    "avg_rating"?: number | null;
                    "biz_id": string;
                    "created_at"?: string;
                    "day_score"?: number | null;
                    "id"?: string;
                    "metric_date": string;
                    "total_clients_count"?: number;
                    "total_revenue"?: number;
                    "total_reviews_count"?: number;
                    "updated_at"?: string;
                };
                Update: {
                    "avg_branch_score"?: number | null;
                    "avg_rating"?: number | null;
                    "biz_id"?: string;
                    "created_at"?: string;
                    "day_score"?: number | null;
                    "id"?: string;
                    "metric_date"?: string;
                    "total_clients_count"?: number;
                    "total_revenue"?: number;
                    "total_reviews_count"?: number;
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "biz_day_metrics_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "booking_creation_requests": {
                Row: {
                    "booking_id": string | null;
                    "caller_hash": string;
                    "created_at": string;
                    "payload_hash": string;
                    "request_id": string;
                    "response": Json | null;
                };
                ComputedFields: never;
                Insert: {
                    "booking_id"?: string | null;
                    "caller_hash": string;
                    "created_at"?: string;
                    "payload_hash": string;
                    "request_id": string;
                    "response"?: Json | null;
                };
                Update: {
                    "booking_id"?: string | null;
                    "caller_hash"?: string;
                    "created_at"?: string;
                    "payload_hash"?: string;
                    "request_id"?: string;
                    "response"?: Json | null;
                };
                Relationships: [
                ];
            };
            "booking_notification_deliveries": {
                Row: {
                    "attempts": number;
                    "channel": string;
                    "delivery_key": string;
                    "event_id": string;
                    "first_attempt_at": string | null;
                    "last_error_code": string | null;
                    "payload": NonNullable<Json>;
                    "provider_id": string | null;
                    "sent_at": string | null;
                    "status": string;
                };
                ComputedFields: never;
                Insert: {
                    "attempts"?: number;
                    "channel": string;
                    "delivery_key": string;
                    "event_id": string;
                    "first_attempt_at"?: string | null;
                    "last_error_code"?: string | null;
                    "payload": NonNullable<Json>;
                    "provider_id"?: string | null;
                    "sent_at"?: string | null;
                    "status"?: string;
                };
                Update: {
                    "attempts"?: number;
                    "channel"?: string;
                    "delivery_key"?: string;
                    "event_id"?: string;
                    "first_attempt_at"?: string | null;
                    "last_error_code"?: string | null;
                    "payload"?: NonNullable<Json>;
                    "provider_id"?: string | null;
                    "sent_at"?: string | null;
                    "status"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "booking_notification_deliveries_event_id_fkey";
                        columns: [
                            "event_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "booking_notification_outbox";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "booking_notification_outbox": {
                Row: {
                    "attempts": number;
                    "available_at": string;
                    "booking_id": string;
                    "booking_revision": number;
                    "completed_at": string | null;
                    "created_at": string;
                    "event_type": string;
                    "id": string;
                    "last_error_code": string | null;
                    "lease_token": string | null;
                    "lease_until": string | null;
                    "payloads_pruned_at": string | null;
                    "prepared_at": string | null;
                    "status": string;
                };
                ComputedFields: never;
                Insert: {
                    "attempts"?: number;
                    "available_at"?: string;
                    "booking_id": string;
                    "booking_revision": number;
                    "completed_at"?: string | null;
                    "created_at"?: string;
                    "event_type": string;
                    "id"?: string;
                    "last_error_code"?: string | null;
                    "lease_token"?: string | null;
                    "lease_until"?: string | null;
                    "payloads_pruned_at"?: string | null;
                    "prepared_at"?: string | null;
                    "status"?: string;
                };
                Update: {
                    "attempts"?: number;
                    "available_at"?: string;
                    "booking_id"?: string;
                    "booking_revision"?: number;
                    "completed_at"?: string | null;
                    "created_at"?: string;
                    "event_type"?: string;
                    "id"?: string;
                    "last_error_code"?: string | null;
                    "lease_token"?: string | null;
                    "lease_until"?: string | null;
                    "payloads_pruned_at"?: string | null;
                    "prepared_at"?: string | null;
                    "status"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "booking_notification_outbox_booking_id_fkey";
                        columns: [
                            "booking_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "bookings";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "booking_services": {
                Row: {
                    "booking_id": string;
                    "created_at": string;
                    "duration_min": number;
                    "id": string;
                    "order_index": number;
                    "price_from": number | null;
                    "price_to": number | null;
                    "service_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "booking_id": string;
                    "created_at"?: string;
                    "duration_min": number;
                    "id"?: string;
                    "order_index"?: number;
                    "price_from"?: number | null;
                    "price_to"?: number | null;
                    "service_id": string;
                };
                Update: {
                    "booking_id"?: string;
                    "created_at"?: string;
                    "duration_min"?: number;
                    "id"?: string;
                    "order_index"?: number;
                    "price_from"?: number | null;
                    "price_to"?: number | null;
                    "service_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "booking_services_booking_id_fkey";
                        columns: [
                            "booking_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "bookings";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "booking_services_service_id_fkey";
                        columns: [
                            "service_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "services";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "bookings": {
                Row: {
                    "biz_id": string;
                    "branch_id": string;
                    "client_email": string | null;
                    "client_id": string | null;
                    "client_name": string | null;
                    "client_phone": string | null;
                    "created_at": string | null;
                    "end_at": string;
                    "expires_at": string | null;
                    "id": string;
                    "notification_revision": number;
                    "promotion_applied": Json | null;
                    "service_id": string;
                    "source": string | null;
                    "staff_id": string;
                    "start_at": string;
                    "status": Database["public"]['Enums']["booking_status"];
                    "subscription_applied": Json | null;
                    "time_range": unknown;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id": string;
                    "branch_id": string;
                    "client_email"?: string | null;
                    "client_id"?: string | null;
                    "client_name"?: string | null;
                    "client_phone"?: string | null;
                    "created_at"?: string | null;
                    "end_at": string;
                    "expires_at"?: string | null;
                    "id"?: string;
                    "notification_revision"?: number;
                    "promotion_applied"?: Json | null;
                    "service_id": string;
                    "source"?: string | null;
                    "staff_id": string;
                    "start_at": string;
                    "status"?: Database["public"]['Enums']["booking_status"];
                    "subscription_applied"?: Json | null;
                    "time_range"?: never;
                };
                Update: {
                    "biz_id"?: string;
                    "branch_id"?: string;
                    "client_email"?: string | null;
                    "client_id"?: string | null;
                    "client_name"?: string | null;
                    "client_phone"?: string | null;
                    "created_at"?: string | null;
                    "end_at"?: string;
                    "expires_at"?: string | null;
                    "id"?: string;
                    "notification_revision"?: number;
                    "promotion_applied"?: Json | null;
                    "service_id"?: string;
                    "source"?: string | null;
                    "staff_id"?: string;
                    "start_at"?: string;
                    "status"?: Database["public"]['Enums']["booking_status"];
                    "subscription_applied"?: Json | null;
                    "time_range"?: never;
                };
                Relationships: [
                    {
                        foreignKeyName: "bookings_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "bookings_branch_id_fkey";
                        columns: [
                            "branch_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "branches";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "bookings_client_id_fkey";
                        columns: [
                            "client_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "bookings_service_id_fkey";
                        columns: [
                            "service_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "services";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "bookings_staff_id_fkey";
                        columns: [
                            "staff_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "staff";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "branch_admins": {
                Row: {
                    "branch_id": string;
                    "created_at": string | null;
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "branch_id": string;
                    "created_at"?: string | null;
                    "user_id": string;
                };
                Update: {
                    "branch_id"?: string;
                    "created_at"?: string | null;
                    "user_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "branch_admins_branch_id_fkey";
                        columns: [
                            "branch_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "branches";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "branch_day_metrics": {
                Row: {
                    "avg_rating": number | null;
                    "avg_staff_score": number | null;
                    "biz_id": string;
                    "branch_id": string;
                    "created_at": string;
                    "day_score": number | null;
                    "id": string;
                    "metric_date": string;
                    "total_clients_count": number;
                    "total_revenue": number;
                    "total_reviews_count": number;
                    "updated_at": string;
                };
                ComputedFields: never;
                Insert: {
                    "avg_rating"?: number | null;
                    "avg_staff_score"?: number | null;
                    "biz_id": string;
                    "branch_id": string;
                    "created_at"?: string;
                    "day_score"?: number | null;
                    "id"?: string;
                    "metric_date": string;
                    "total_clients_count"?: number;
                    "total_revenue"?: number;
                    "total_reviews_count"?: number;
                    "updated_at"?: string;
                };
                Update: {
                    "avg_rating"?: number | null;
                    "avg_staff_score"?: number | null;
                    "biz_id"?: string;
                    "branch_id"?: string;
                    "created_at"?: string;
                    "day_score"?: number | null;
                    "id"?: string;
                    "metric_date"?: string;
                    "total_clients_count"?: number;
                    "total_revenue"?: number;
                    "total_reviews_count"?: number;
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "branch_day_metrics_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "branch_day_metrics_branch_id_fkey";
                        columns: [
                            "branch_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "branches";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "branch_promotions": {
                Row: {
                    "biz_id": string;
                    "branch_id": string;
                    "created_at": string;
                    "description_en": string | null;
                    "description_ky": string | null;
                    "description_ru": string | null;
                    "id": string;
                    "is_active": boolean;
                    "params": NonNullable<Json>;
                    "promotion_type": Database["public"]['Enums']["promotion_type"];
                    "title_en": string | null;
                    "title_ky": string | null;
                    "title_ru": string;
                    "updated_at": string;
                    "valid_from": string | null;
                    "valid_to": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id": string;
                    "branch_id": string;
                    "created_at"?: string;
                    "description_en"?: string | null;
                    "description_ky"?: string | null;
                    "description_ru"?: string | null;
                    "id"?: string;
                    "is_active"?: boolean;
                    "params"?: NonNullable<Json>;
                    "promotion_type": Database["public"]['Enums']["promotion_type"];
                    "title_en"?: string | null;
                    "title_ky"?: string | null;
                    "title_ru": string;
                    "updated_at"?: string;
                    "valid_from"?: string | null;
                    "valid_to"?: string | null;
                };
                Update: {
                    "biz_id"?: string;
                    "branch_id"?: string;
                    "created_at"?: string;
                    "description_en"?: string | null;
                    "description_ky"?: string | null;
                    "description_ru"?: string | null;
                    "id"?: string;
                    "is_active"?: boolean;
                    "params"?: NonNullable<Json>;
                    "promotion_type"?: Database["public"]['Enums']["promotion_type"];
                    "title_en"?: string | null;
                    "title_ky"?: string | null;
                    "title_ru"?: string;
                    "updated_at"?: string;
                    "valid_from"?: string | null;
                    "valid_to"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "branch_promotions_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "branch_promotions_branch_id_fkey";
                        columns: [
                            "branch_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "branches";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "branch_working_hours": {
                Row: {
                    "biz_id": string;
                    "branch_id": string;
                    "breaks": NonNullable<Json>;
                    "created_at": string;
                    "day_of_week": number;
                    "id": string;
                    "intervals": NonNullable<Json>;
                    "updated_at": string;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id": string;
                    "branch_id": string;
                    "breaks"?: NonNullable<Json>;
                    "created_at"?: string;
                    "day_of_week": number;
                    "id"?: string;
                    "intervals"?: NonNullable<Json>;
                    "updated_at"?: string;
                };
                Update: {
                    "biz_id"?: string;
                    "branch_id"?: string;
                    "breaks"?: NonNullable<Json>;
                    "created_at"?: string;
                    "day_of_week"?: number;
                    "id"?: string;
                    "intervals"?: NonNullable<Json>;
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "branch_working_hours_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "branch_working_hours_branch_id_fkey";
                        columns: [
                            "branch_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "branches";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "branches": {
                Row: {
                    "address": string | null;
                    "biz_id": string;
                    "contact_email": string | null;
                    "contact_phone": string | null;
                    "contact_whatsapp": string | null;
                    "coords": unknown;
                    "created_at": string | null;
                    "directory_links": NonNullable<Json>;
                    "id": string;
                    "inherit_business_contacts": boolean;
                    "is_active": boolean | null;
                    "last_rating_recalculated_at": string | null;
                    "lat": number | null;
                    "lon": number | null;
                    "name": string;
                    "rating_score": number | null;
                    "rating_updated_at": string | null;
                    "website_url": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "address"?: string | null;
                    "biz_id": string;
                    "contact_email"?: string | null;
                    "contact_phone"?: string | null;
                    "contact_whatsapp"?: string | null;
                    "coords"?: unknown;
                    "created_at"?: string | null;
                    "directory_links"?: NonNullable<Json>;
                    "id"?: string;
                    "inherit_business_contacts"?: boolean;
                    "is_active"?: boolean | null;
                    "last_rating_recalculated_at"?: string | null;
                    "lat"?: never;
                    "lon"?: never;
                    "name": string;
                    "rating_score"?: number | null;
                    "rating_updated_at"?: string | null;
                    "website_url"?: string | null;
                };
                Update: {
                    "address"?: string | null;
                    "biz_id"?: string;
                    "contact_email"?: string | null;
                    "contact_phone"?: string | null;
                    "contact_whatsapp"?: string | null;
                    "coords"?: unknown;
                    "created_at"?: string | null;
                    "directory_links"?: NonNullable<Json>;
                    "id"?: string;
                    "inherit_business_contacts"?: boolean;
                    "is_active"?: boolean | null;
                    "last_rating_recalculated_at"?: string | null;
                    "lat"?: never;
                    "lon"?: never;
                    "name"?: string;
                    "rating_score"?: number | null;
                    "rating_updated_at"?: string | null;
                    "website_url"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "branches_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "business_creation_audit_log": {
                Row: {
                    "actor_user_id": string | null;
                    "application_id": string | null;
                    "business_id": string;
                    "created_at": string;
                    "event_type": string;
                    "id": string;
                    "metadata": NonNullable<Json>;
                    "reason": string | null;
                    "source": string;
                };
                ComputedFields: never;
                Insert: {
                    "actor_user_id"?: string | null;
                    "application_id"?: string | null;
                    "business_id": string;
                    "created_at"?: string;
                    "event_type": string;
                    "id"?: string;
                    "metadata"?: NonNullable<Json>;
                    "reason"?: string | null;
                    "source": string;
                };
                Update: {
                    "actor_user_id"?: string | null;
                    "application_id"?: string | null;
                    "business_id"?: string;
                    "created_at"?: string;
                    "event_type"?: string;
                    "id"?: string;
                    "metadata"?: NonNullable<Json>;
                    "reason"?: string | null;
                    "source"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "business_creation_audit_log_actor_user_id_fkey";
                        columns: [
                            "actor_user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "business_creation_audit_log_application_id_fkey";
                        columns: [
                            "application_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "business_registration_applications";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "business_creation_audit_log_business_id_fkey";
                        columns: [
                            "business_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "business_daily_stats": {
                Row: {
                    "biz_id": string;
                    "booking_flow_starts": number;
                    "bookings_confirmed_or_paid": number;
                    "bookings_created": number;
                    "business_page_views": number;
                    "created_at": string;
                    "date": string;
                    "home_views": number;
                    "promo_bookings": number;
                    "promo_revenue": number;
                    "total_revenue": number;
                    "updated_at": string;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id": string;
                    "booking_flow_starts"?: number;
                    "bookings_confirmed_or_paid"?: number;
                    "bookings_created"?: number;
                    "business_page_views"?: number;
                    "created_at"?: string;
                    "date": string;
                    "home_views"?: number;
                    "promo_bookings"?: number;
                    "promo_revenue"?: number;
                    "total_revenue"?: number;
                    "updated_at"?: string;
                };
                Update: {
                    "biz_id"?: string;
                    "booking_flow_starts"?: number;
                    "bookings_confirmed_or_paid"?: number;
                    "bookings_created"?: number;
                    "business_page_views"?: number;
                    "created_at"?: string;
                    "date"?: string;
                    "home_views"?: number;
                    "promo_bookings"?: number;
                    "promo_revenue"?: number;
                    "total_revenue"?: number;
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "business_daily_stats_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "business_hourly_load": {
                Row: {
                    "biz_id": string;
                    "bookings_count": number;
                    "branch_id": string;
                    "created_at": string;
                    "date": string;
                    "hour": number;
                    "promo_bookings_count": number;
                    "staff_count": number | null;
                    "unique_clients_count": number | null;
                    "updated_at": string;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id": string;
                    "bookings_count"?: number;
                    "branch_id": string;
                    "created_at"?: string;
                    "date": string;
                    "hour": number;
                    "promo_bookings_count"?: number;
                    "staff_count"?: number | null;
                    "unique_clients_count"?: number | null;
                    "updated_at"?: string;
                };
                Update: {
                    "biz_id"?: string;
                    "bookings_count"?: number;
                    "branch_id"?: string;
                    "created_at"?: string;
                    "date"?: string;
                    "hour"?: number;
                    "promo_bookings_count"?: number;
                    "staff_count"?: number | null;
                    "unique_clients_count"?: number | null;
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "business_hourly_load_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "business_hourly_load_branch_id_fkey";
                        columns: [
                            "branch_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "branches";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "business_registration_applications": {
                Row: {
                    "applicant_user_id": string | null;
                    "business_name": string;
                    "category": string | null;
                    "city": string | null;
                    "comment": string | null;
                    "contact_name": string;
                    "created_at": string;
                    "created_business_id": string | null;
                    "directory_links": NonNullable<Json>;
                    "email": string | null;
                    "id": string;
                    "phone": string;
                    "prior_submission_count": number;
                    "review_note": string | null;
                    "reviewed_at": string | null;
                    "reviewed_by": string | null;
                    "risk_flags": (string)[];
                    "source": string;
                    "status": string;
                    "updated_at": string;
                };
                ComputedFields: never;
                Insert: {
                    "applicant_user_id"?: string | null;
                    "business_name": string;
                    "category"?: string | null;
                    "city"?: string | null;
                    "comment"?: string | null;
                    "contact_name": string;
                    "created_at"?: string;
                    "created_business_id"?: string | null;
                    "directory_links"?: NonNullable<Json>;
                    "email"?: string | null;
                    "id"?: string;
                    "phone": string;
                    "prior_submission_count"?: number;
                    "review_note"?: string | null;
                    "reviewed_at"?: string | null;
                    "reviewed_by"?: string | null;
                    "risk_flags"?: (string)[];
                    "source"?: string;
                    "status"?: string;
                    "updated_at"?: string;
                };
                Update: {
                    "applicant_user_id"?: string | null;
                    "business_name"?: string;
                    "category"?: string | null;
                    "city"?: string | null;
                    "comment"?: string | null;
                    "contact_name"?: string;
                    "created_at"?: string;
                    "created_business_id"?: string | null;
                    "directory_links"?: NonNullable<Json>;
                    "email"?: string | null;
                    "id"?: string;
                    "phone"?: string;
                    "prior_submission_count"?: number;
                    "review_note"?: string | null;
                    "reviewed_at"?: string | null;
                    "reviewed_by"?: string | null;
                    "risk_flags"?: (string)[];
                    "source"?: string;
                    "status"?: string;
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "business_registration_applications_applicant_user_id_fkey";
                        columns: [
                            "applicant_user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "business_registration_applications_created_business_id_fkey";
                        columns: [
                            "created_business_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "business_registration_applications_reviewed_by_fkey";
                        columns: [
                            "reviewed_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "business_role_applications": {
                Row: {
                    "applicant_email": string | null;
                    "applicant_name": string | null;
                    "applicant_phone": string | null;
                    "applicant_user_id": string;
                    "biz_id": string;
                    "created_at": string;
                    "evidence_links": NonNullable<Json>;
                    "id": string;
                    "message": string | null;
                    "policy_version": number;
                    "prior_submission_count": number;
                    "requested_role": string;
                    "review_note": string | null;
                    "reviewed_at": string | null;
                    "reviewed_by": string | null;
                    "risk_flags": (string)[];
                    "source": string;
                    "status": string;
                    "updated_at": string;
                };
                ComputedFields: never;
                Insert: {
                    "applicant_email"?: string | null;
                    "applicant_name"?: string | null;
                    "applicant_phone"?: string | null;
                    "applicant_user_id": string;
                    "biz_id": string;
                    "created_at"?: string;
                    "evidence_links"?: NonNullable<Json>;
                    "id"?: string;
                    "message"?: string | null;
                    "policy_version"?: number;
                    "prior_submission_count"?: number;
                    "requested_role": string;
                    "review_note"?: string | null;
                    "reviewed_at"?: string | null;
                    "reviewed_by"?: string | null;
                    "risk_flags"?: (string)[];
                    "source"?: string;
                    "status"?: string;
                    "updated_at"?: string;
                };
                Update: {
                    "applicant_email"?: string | null;
                    "applicant_name"?: string | null;
                    "applicant_phone"?: string | null;
                    "applicant_user_id"?: string;
                    "biz_id"?: string;
                    "created_at"?: string;
                    "evidence_links"?: NonNullable<Json>;
                    "id"?: string;
                    "message"?: string | null;
                    "policy_version"?: number;
                    "prior_submission_count"?: number;
                    "requested_role"?: string;
                    "review_note"?: string | null;
                    "reviewed_at"?: string | null;
                    "reviewed_by"?: string | null;
                    "risk_flags"?: (string)[];
                    "source"?: string;
                    "status"?: string;
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "business_role_applications_applicant_user_id_fkey";
                        columns: [
                            "applicant_user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "business_role_applications_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "business_role_applications_reviewed_by_fkey";
                        columns: [
                            "reviewed_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "businesses": {
                Row: {
                    "address": string | null;
                    "branch_limit": number;
                    "categories": (string)[] | null;
                    "city_id": string | null;
                    "contact_email": string | null;
                    "contact_phone": string | null;
                    "contact_whatsapp": string | null;
                    "coords": unknown;
                    "created_at": string | null;
                    "created_by_user_id": string | null;
                    "creation_source": string;
                    "email_notify_to": (string)[] | null;
                    "id": string;
                    "is_approved": boolean | null;
                    "last_rating_recalculated_at": string | null;
                    "name": string;
                    "owner_id": string | null;
                    "phones": (string)[] | null;
                    "plan": string | null;
                    "rating_score": number | null;
                    "rating_updated_at": string | null;
                    "slug": string;
                    "source_application_id": string | null;
                    "tz": string | null;
                    "website_url": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "address"?: string | null;
                    "branch_limit"?: number;
                    "categories"?: (string)[] | null;
                    "city_id"?: string | null;
                    "contact_email"?: string | null;
                    "contact_phone"?: string | null;
                    "contact_whatsapp"?: string | null;
                    "coords"?: unknown;
                    "created_at"?: string | null;
                    "created_by_user_id"?: string | null;
                    "creation_source"?: string;
                    "email_notify_to"?: (string)[] | null;
                    "id"?: string;
                    "is_approved"?: boolean | null;
                    "last_rating_recalculated_at"?: string | null;
                    "name": string;
                    "owner_id"?: string | null;
                    "phones"?: (string)[] | null;
                    "plan"?: string | null;
                    "rating_score"?: number | null;
                    "rating_updated_at"?: string | null;
                    "slug": string;
                    "source_application_id"?: string | null;
                    "tz"?: string | null;
                    "website_url"?: string | null;
                };
                Update: {
                    "address"?: string | null;
                    "branch_limit"?: number;
                    "categories"?: (string)[] | null;
                    "city_id"?: string | null;
                    "contact_email"?: string | null;
                    "contact_phone"?: string | null;
                    "contact_whatsapp"?: string | null;
                    "coords"?: unknown;
                    "created_at"?: string | null;
                    "created_by_user_id"?: string | null;
                    "creation_source"?: string;
                    "email_notify_to"?: (string)[] | null;
                    "id"?: string;
                    "is_approved"?: boolean | null;
                    "last_rating_recalculated_at"?: string | null;
                    "name"?: string;
                    "owner_id"?: string | null;
                    "phones"?: (string)[] | null;
                    "plan"?: string | null;
                    "rating_score"?: number | null;
                    "rating_updated_at"?: string | null;
                    "slug"?: string;
                    "source_application_id"?: string | null;
                    "tz"?: string | null;
                    "website_url"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "businesses_created_by_user_id_fkey";
                        columns: [
                            "created_by_user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "businesses_owner_id_fkey";
                        columns: [
                            "owner_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "businesses_source_application_id_fkey";
                        columns: [
                            "source_application_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "business_registration_applications";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "categories": {
                Row: {
                    "created_at": string | null;
                    "id": string;
                    "is_active": boolean | null;
                    "name_ru": string;
                    "slug": string;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string | null;
                    "id"?: string;
                    "is_active"?: boolean | null;
                    "name_ru": string;
                    "slug": string;
                };
                Update: {
                    "created_at"?: string | null;
                    "id"?: string;
                    "is_active"?: boolean | null;
                    "name_ru"?: string;
                    "slug"?: string;
                };
                Relationships: [
                ];
            };
            "client_promotion_usage": {
                Row: {
                    "biz_id": string;
                    "booking_id": string | null;
                    "branch_id": string;
                    "client_id": string;
                    "created_at": string;
                    "id": string;
                    "promotion_id": string;
                    "promotion_type": Database["public"]['Enums']["promotion_type"];
                    "usage_data": NonNullable<Json>;
                    "used_at": string;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id": string;
                    "booking_id"?: string | null;
                    "branch_id": string;
                    "client_id": string;
                    "created_at"?: string;
                    "id"?: string;
                    "promotion_id": string;
                    "promotion_type": Database["public"]['Enums']["promotion_type"];
                    "usage_data"?: NonNullable<Json>;
                    "used_at"?: string;
                };
                Update: {
                    "biz_id"?: string;
                    "booking_id"?: string | null;
                    "branch_id"?: string;
                    "client_id"?: string;
                    "created_at"?: string;
                    "id"?: string;
                    "promotion_id"?: string;
                    "promotion_type"?: Database["public"]['Enums']["promotion_type"];
                    "usage_data"?: NonNullable<Json>;
                    "used_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "client_promotion_usage_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "client_promotion_usage_booking_id_fkey";
                        columns: [
                            "booking_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "bookings";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "client_promotion_usage_branch_id_fkey";
                        columns: [
                            "branch_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "branches";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "client_promotion_usage_client_id_fkey";
                        columns: [
                            "client_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "client_promotion_usage_promotion_id_fkey";
                        columns: [
                            "promotion_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "branch_promotions";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "client_referrals": {
                Row: {
                    "biz_id": string;
                    "branch_id": string;
                    "created_at": string;
                    "id": string;
                    "referred_booking_id": string | null;
                    "referred_id": string;
                    "referrer_bonus_used": boolean;
                    "referrer_booking_id": string | null;
                    "referrer_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id": string;
                    "branch_id": string;
                    "created_at"?: string;
                    "id"?: string;
                    "referred_booking_id"?: string | null;
                    "referred_id": string;
                    "referrer_bonus_used"?: boolean;
                    "referrer_booking_id"?: string | null;
                    "referrer_id": string;
                };
                Update: {
                    "biz_id"?: string;
                    "branch_id"?: string;
                    "created_at"?: string;
                    "id"?: string;
                    "referred_booking_id"?: string | null;
                    "referred_id"?: string;
                    "referrer_bonus_used"?: boolean;
                    "referrer_booking_id"?: string | null;
                    "referrer_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "client_referrals_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "client_referrals_branch_id_fkey";
                        columns: [
                            "branch_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "branches";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "client_referrals_referred_booking_id_fkey";
                        columns: [
                            "referred_booking_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "bookings";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "client_referrals_referred_id_fkey";
                        columns: [
                            "referred_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "client_referrals_referrer_booking_id_fkey";
                        columns: [
                            "referrer_booking_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "bookings";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "client_referrals_referrer_id_fkey";
                        columns: [
                            "referrer_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "client_visit_package_uses": {
                Row: {
                    "booking_id": string;
                    "client_visit_package_id": string;
                    "id": string;
                    "used_at": string;
                };
                ComputedFields: never;
                Insert: {
                    "booking_id": string;
                    "client_visit_package_id": string;
                    "id"?: string;
                    "used_at"?: string;
                };
                Update: {
                    "booking_id"?: string;
                    "client_visit_package_id"?: string;
                    "id"?: string;
                    "used_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "client_visit_package_uses_booking_id_fkey";
                        columns: [
                            "booking_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "bookings";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "client_visit_package_uses_client_visit_package_id_fkey";
                        columns: [
                            "client_visit_package_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "client_visit_packages";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "client_visit_packages": {
                Row: {
                    "client_id": string;
                    "created_at": string;
                    "id": string;
                    "plan_id": string;
                    "purchased_at": string;
                    "remaining_visits": number;
                    "request_id": string | null;
                    "valid_until": string;
                };
                ComputedFields: never;
                Insert: {
                    "client_id": string;
                    "created_at"?: string;
                    "id"?: string;
                    "plan_id": string;
                    "purchased_at"?: string;
                    "remaining_visits": number;
                    "request_id"?: string | null;
                    "valid_until": string;
                };
                Update: {
                    "client_id"?: string;
                    "created_at"?: string;
                    "id"?: string;
                    "plan_id"?: string;
                    "purchased_at"?: string;
                    "remaining_visits"?: number;
                    "request_id"?: string | null;
                    "valid_until"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "client_visit_packages_client_id_fkey";
                        columns: [
                            "client_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "client_visit_packages_plan_id_fkey";
                        columns: [
                            "plan_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "visit_package_plans";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "cron_executions": {
                Row: {
                    "completed_at": string | null;
                    "error_code": string | null;
                    "http_status": number | null;
                    "id": string;
                    "job": string;
                    "outcome": string;
                    "started_at": string;
                };
                ComputedFields: never;
                Insert: {
                    "completed_at"?: string | null;
                    "error_code"?: string | null;
                    "http_status"?: number | null;
                    "id": string;
                    "job": string;
                    "outcome"?: string;
                    "started_at"?: string;
                };
                Update: {
                    "completed_at"?: string | null;
                    "error_code"?: string | null;
                    "http_status"?: number | null;
                    "id"?: string;
                    "job"?: string;
                    "outcome"?: string;
                    "started_at"?: string;
                };
                Relationships: [
                ];
            };
            "finance_settings_audit_log": {
                Row: {
                    "biz_id": string;
                    "changed_at": string;
                    "changed_by_user_id": string | null;
                    "field_changes": NonNullable<Json>;
                    "id": string;
                    "message": string | null;
                    "staff_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id": string;
                    "changed_at"?: string;
                    "changed_by_user_id"?: string | null;
                    "field_changes"?: NonNullable<Json>;
                    "id"?: string;
                    "message"?: string | null;
                    "staff_id": string;
                };
                Update: {
                    "biz_id"?: string;
                    "changed_at"?: string;
                    "changed_by_user_id"?: string | null;
                    "field_changes"?: NonNullable<Json>;
                    "id"?: string;
                    "message"?: string | null;
                    "staff_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "finance_settings_audit_log_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "finance_settings_audit_log_changed_by_user_id_fkey";
                        columns: [
                            "changed_by_user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "finance_settings_audit_log_staff_id_fkey";
                        columns: [
                            "staff_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "staff";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "frontend_metrics": {
                Row: {
                    "created_at": string;
                    "id": string;
                    "ip_address": unknown;
                    "metric_data": NonNullable<Json>;
                    "metric_type": string;
                    "page": string | null;
                    "user_agent": string | null;
                    "user_id": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string;
                    "id"?: string;
                    "ip_address"?: unknown;
                    "metric_data": NonNullable<Json>;
                    "metric_type": string;
                    "page"?: string | null;
                    "user_agent"?: string | null;
                    "user_id"?: string | null;
                };
                Update: {
                    "created_at"?: string;
                    "id"?: string;
                    "ip_address"?: unknown;
                    "metric_data"?: NonNullable<Json>;
                    "metric_type"?: string;
                    "page"?: string | null;
                    "user_agent"?: string | null;
                    "user_id"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "frontend_metrics_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "funnel_events": {
                Row: {
                    "biz_id": string;
                    "booking_id": string | null;
                    "branch_id": string | null;
                    "created_at": string;
                    "event_type": string;
                    "id": string;
                    "metadata": Json | null;
                    "referrer": string | null;
                    "service_id": string | null;
                    "session_id": string;
                    "slot_start_at": string | null;
                    "source": string;
                    "staff_id": string | null;
                    "user_agent": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id": string;
                    "booking_id"?: string | null;
                    "branch_id"?: string | null;
                    "created_at"?: string;
                    "event_type": string;
                    "id"?: string;
                    "metadata"?: Json | null;
                    "referrer"?: string | null;
                    "service_id"?: string | null;
                    "session_id": string;
                    "slot_start_at"?: string | null;
                    "source": string;
                    "staff_id"?: string | null;
                    "user_agent"?: string | null;
                };
                Update: {
                    "biz_id"?: string;
                    "booking_id"?: string | null;
                    "branch_id"?: string | null;
                    "created_at"?: string;
                    "event_type"?: string;
                    "id"?: string;
                    "metadata"?: Json | null;
                    "referrer"?: string | null;
                    "service_id"?: string | null;
                    "session_id"?: string;
                    "slot_start_at"?: string | null;
                    "source"?: string;
                    "staff_id"?: string | null;
                    "user_agent"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "funnel_events_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "mobile_session_grants": {
                Row: {
                    "code_challenge": string;
                    "code_hash": string;
                    "consumed_at": string | null;
                    "created_at": string;
                    "expires_at": string;
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "code_challenge": string;
                    "code_hash": string;
                    "consumed_at"?: string | null;
                    "created_at"?: string;
                    "expires_at"?: string;
                    "user_id": string;
                };
                Update: {
                    "code_challenge"?: string;
                    "code_hash"?: string;
                    "consumed_at"?: string | null;
                    "created_at"?: string;
                    "expires_at"?: string;
                    "user_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "mobile_session_grants_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "profiles": {
                Row: {
                    "full_name": string | null;
                    "id": string;
                    "notify_email": boolean | null;
                    "notify_sms": boolean | null;
                    "notify_telegram": boolean | null;
                    "notify_whatsapp": boolean | null;
                    "phone": string | null;
                    "preferred_locale": string | null;
                    "telegram_id": number | null;
                    "telegram_photo_url": string | null;
                    "telegram_username": string | null;
                    "telegram_verified": boolean | null;
                    "whatsapp_phone": string | null;
                    "whatsapp_verified": boolean | null;
                    "yandex_id": string | null;
                    "yandex_username": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "full_name"?: string | null;
                    "id": string;
                    "notify_email"?: boolean | null;
                    "notify_sms"?: boolean | null;
                    "notify_telegram"?: boolean | null;
                    "notify_whatsapp"?: boolean | null;
                    "phone"?: string | null;
                    "preferred_locale"?: string | null;
                    "telegram_id"?: number | null;
                    "telegram_photo_url"?: string | null;
                    "telegram_username"?: string | null;
                    "telegram_verified"?: boolean | null;
                    "whatsapp_phone"?: string | null;
                    "whatsapp_verified"?: boolean | null;
                    "yandex_id"?: string | null;
                    "yandex_username"?: string | null;
                };
                Update: {
                    "full_name"?: string | null;
                    "id"?: string;
                    "notify_email"?: boolean | null;
                    "notify_sms"?: boolean | null;
                    "notify_telegram"?: boolean | null;
                    "notify_whatsapp"?: boolean | null;
                    "phone"?: string | null;
                    "preferred_locale"?: string | null;
                    "telegram_id"?: number | null;
                    "telegram_photo_url"?: string | null;
                    "telegram_username"?: string | null;
                    "telegram_verified"?: boolean | null;
                    "whatsapp_phone"?: string | null;
                    "whatsapp_verified"?: boolean | null;
                    "yandex_id"?: string | null;
                    "yandex_username"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "profiles_id_fkey";
                        columns: [
                            "id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "rating_biz_config": {
                Row: {
                    "biz_id": string;
                    "category_slug": string | null;
                    "created_at": string;
                    "id": string;
                    "is_active": boolean;
                    "staff_discipline_weight": number;
                    "staff_loyalty_weight": number;
                    "staff_productivity_weight": number;
                    "staff_reviews_weight": number;
                    "updated_at": string;
                    "valid_from": string;
                    "window_days": number;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id": string;
                    "category_slug"?: string | null;
                    "created_at"?: string;
                    "id"?: string;
                    "is_active"?: boolean;
                    "staff_discipline_weight": number;
                    "staff_loyalty_weight": number;
                    "staff_productivity_weight": number;
                    "staff_reviews_weight": number;
                    "updated_at"?: string;
                    "valid_from"?: string;
                    "window_days": number;
                };
                Update: {
                    "biz_id"?: string;
                    "category_slug"?: string | null;
                    "created_at"?: string;
                    "id"?: string;
                    "is_active"?: boolean;
                    "staff_discipline_weight"?: number;
                    "staff_loyalty_weight"?: number;
                    "staff_productivity_weight"?: number;
                    "staff_reviews_weight"?: number;
                    "updated_at"?: string;
                    "valid_from"?: string;
                    "window_days"?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: "rating_biz_config_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "rating_global_config": {
                Row: {
                    "created_at": string;
                    "id": string;
                    "is_active": boolean;
                    "staff_discipline_weight": number;
                    "staff_loyalty_weight": number;
                    "staff_productivity_weight": number;
                    "staff_reviews_weight": number;
                    "updated_at": string;
                    "valid_from": string;
                    "window_days": number;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string;
                    "id"?: string;
                    "is_active"?: boolean;
                    "staff_discipline_weight"?: number;
                    "staff_loyalty_weight"?: number;
                    "staff_productivity_weight"?: number;
                    "staff_reviews_weight"?: number;
                    "updated_at"?: string;
                    "valid_from"?: string;
                    "window_days"?: number;
                };
                Update: {
                    "created_at"?: string;
                    "id"?: string;
                    "is_active"?: boolean;
                    "staff_discipline_weight"?: number;
                    "staff_loyalty_weight"?: number;
                    "staff_productivity_weight"?: number;
                    "staff_reviews_weight"?: number;
                    "updated_at"?: string;
                    "valid_from"?: string;
                    "window_days"?: number;
                };
                Relationships: [
                ];
            };
            "rating_jobs": {
                Row: {
                    "created_at": string;
                    "created_by": string | null;
                    "date_from": string;
                    "date_to": string;
                    "error_message": string | null;
                    "error_summary": Json | null;
                    "finished_at": string | null;
                    "id": string;
                    "processed_days": number;
                    "scope": string;
                    "started_at": string | null;
                    "status": string;
                    "total_days": number;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string;
                    "created_by"?: string | null;
                    "date_from": string;
                    "date_to": string;
                    "error_message"?: string | null;
                    "error_summary"?: Json | null;
                    "finished_at"?: string | null;
                    "id"?: string;
                    "processed_days"?: number;
                    "scope"?: string;
                    "started_at"?: string | null;
                    "status"?: string;
                    "total_days"?: number;
                };
                Update: {
                    "created_at"?: string;
                    "created_by"?: string | null;
                    "date_from"?: string;
                    "date_to"?: string;
                    "error_message"?: string | null;
                    "error_summary"?: Json | null;
                    "finished_at"?: string | null;
                    "id"?: string;
                    "processed_days"?: number;
                    "scope"?: string;
                    "started_at"?: string | null;
                    "status"?: string;
                    "total_days"?: number;
                };
                Relationships: [
                ];
            };
            "rating_manual_recalc_log": {
                Row: {
                    "action": string;
                    "created_at": string;
                    "date_from": string | null;
                    "date_to": string | null;
                    "entity_id": string;
                    "entity_type": string;
                    "error_message": string | null;
                    "id": string;
                    "status": string;
                    "user_id": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "action": string;
                    "created_at"?: string;
                    "date_from"?: string | null;
                    "date_to"?: string | null;
                    "entity_id": string;
                    "entity_type": string;
                    "error_message"?: string | null;
                    "id"?: string;
                    "status": string;
                    "user_id"?: string | null;
                };
                Update: {
                    "action"?: string;
                    "created_at"?: string;
                    "date_from"?: string | null;
                    "date_to"?: string | null;
                    "entity_id"?: string;
                    "entity_type"?: string;
                    "error_message"?: string | null;
                    "id"?: string;
                    "status"?: string;
                    "user_id"?: string | null;
                };
                Relationships: [
                ];
            };
            "rating_recalc_errors": {
                Row: {
                    "created_at": string;
                    "entity_id": string;
                    "entity_type": string;
                    "error_message": string;
                    "id": string;
                    "metric_date": string;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string;
                    "entity_id": string;
                    "entity_type": string;
                    "error_message": string;
                    "id"?: string;
                    "metric_date": string;
                };
                Update: {
                    "created_at"?: string;
                    "entity_id"?: string;
                    "entity_type"?: string;
                    "error_message"?: string;
                    "id"?: string;
                    "metric_date"?: string;
                };
                Relationships: [
                ];
            };
            "reviews": {
                Row: {
                    "booking_id": string;
                    "client_id": string;
                    "comment": string | null;
                    "created_at": string;
                    "id": string;
                    "rating": number;
                    "updated_at": string;
                };
                ComputedFields: never;
                Insert: {
                    "booking_id": string;
                    "client_id": string;
                    "comment"?: string | null;
                    "created_at"?: string;
                    "id"?: string;
                    "rating": number;
                    "updated_at"?: string;
                };
                Update: {
                    "booking_id"?: string;
                    "client_id"?: string;
                    "comment"?: string | null;
                    "created_at"?: string;
                    "id"?: string;
                    "rating"?: number;
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "reviews_booking_id_fkey";
                        columns: [
                            "booking_id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "bookings";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "roles": {
                Row: {
                    "created_at": string | null;
                    "description": string | null;
                    "id": string;
                    "is_system": boolean | null;
                    "key": string;
                    "name": string;
                    "scope": string;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string | null;
                    "description"?: string | null;
                    "id"?: string;
                    "is_system"?: boolean | null;
                    "key": string;
                    "name": string;
                    "scope"?: string;
                };
                Update: {
                    "created_at"?: string | null;
                    "description"?: string | null;
                    "id"?: string;
                    "is_system"?: boolean | null;
                    "key"?: string;
                    "name"?: string;
                    "scope"?: string;
                };
                Relationships: [
                ];
            };
            "service_staff": {
                Row: {
                    "is_active": boolean;
                    "service_id": string;
                    "staff_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "is_active"?: boolean;
                    "service_id": string;
                    "staff_id": string;
                };
                Update: {
                    "is_active"?: boolean;
                    "service_id"?: string;
                    "staff_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "service_staff_service_id_fkey";
                        columns: [
                            "service_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "services";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "service_staff_staff_id_fkey";
                        columns: [
                            "staff_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "staff";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "services": {
                Row: {
                    "active": boolean | null;
                    "biz_id": string;
                    "branch_id": string;
                    "created_at": string | null;
                    "duration_min": number;
                    "id": string;
                    "name_en": string | null;
                    "name_ky": string | null;
                    "name_ru": string;
                    "price_from": number;
                    "price_to": number;
                };
                ComputedFields: never;
                Insert: {
                    "active"?: boolean | null;
                    "biz_id": string;
                    "branch_id": string;
                    "created_at"?: string | null;
                    "duration_min": number;
                    "id"?: string;
                    "name_en"?: string | null;
                    "name_ky"?: string | null;
                    "name_ru": string;
                    "price_from": number;
                    "price_to": number;
                };
                Update: {
                    "active"?: boolean | null;
                    "biz_id"?: string;
                    "branch_id"?: string;
                    "created_at"?: string | null;
                    "duration_min"?: number;
                    "id"?: string;
                    "name_en"?: string | null;
                    "name_ky"?: string | null;
                    "name_ru"?: string;
                    "price_from"?: number;
                    "price_to"?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: "services_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "services_branch_id_fkey";
                        columns: [
                            "branch_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "branches";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "spatial_ref_sys": {
                Row: {
                    "auth_name": string | null;
                    "auth_srid": number | null;
                    "proj4text": string | null;
                    "srid": number;
                    "srtext": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "auth_name"?: string | null;
                    "auth_srid"?: number | null;
                    "proj4text"?: string | null;
                    "srid": number;
                    "srtext"?: string | null;
                };
                Update: {
                    "auth_name"?: string | null;
                    "auth_srid"?: number | null;
                    "proj4text"?: string | null;
                    "srid"?: number;
                    "srtext"?: string | null;
                };
                Relationships: [
                ];
            };
            "staff": {
                Row: {
                    "avatar_url": string | null;
                    "biz_id": string;
                    "branch_id": string;
                    "created_at": string | null;
                    "email": string | null;
                    "full_name": string;
                    "hourly_rate": number | null;
                    "id": string;
                    "is_active": boolean | null;
                    "last_rating_recalculated_at": string | null;
                    "percent_master": number;
                    "percent_salon": number;
                    "phone": string | null;
                    "rating_score": number | null;
                    "rating_updated_at": string | null;
                    "skills": (string)[] | null;
                    "user_id": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "avatar_url"?: string | null;
                    "biz_id": string;
                    "branch_id": string;
                    "created_at"?: string | null;
                    "email"?: string | null;
                    "full_name": string;
                    "hourly_rate"?: number | null;
                    "id"?: string;
                    "is_active"?: boolean | null;
                    "last_rating_recalculated_at"?: string | null;
                    "percent_master"?: number;
                    "percent_salon"?: number;
                    "phone"?: string | null;
                    "rating_score"?: number | null;
                    "rating_updated_at"?: string | null;
                    "skills"?: (string)[] | null;
                    "user_id"?: string | null;
                };
                Update: {
                    "avatar_url"?: string | null;
                    "biz_id"?: string;
                    "branch_id"?: string;
                    "created_at"?: string | null;
                    "email"?: string | null;
                    "full_name"?: string;
                    "hourly_rate"?: number | null;
                    "id"?: string;
                    "is_active"?: boolean | null;
                    "last_rating_recalculated_at"?: string | null;
                    "percent_master"?: number;
                    "percent_salon"?: number;
                    "phone"?: string | null;
                    "rating_score"?: number | null;
                    "rating_updated_at"?: string | null;
                    "skills"?: (string)[] | null;
                    "user_id"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "staff_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "staff_branch_id_fkey";
                        columns: [
                            "branch_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "branches";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "staff_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "staff_branch_assignments": {
                Row: {
                    "biz_id": string;
                    "branch_id": string;
                    "id": string;
                    "staff_id": string;
                    "valid_from": string;
                    "valid_to": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id": string;
                    "branch_id": string;
                    "id"?: string;
                    "staff_id": string;
                    "valid_from": string;
                    "valid_to"?: string | null;
                };
                Update: {
                    "biz_id"?: string;
                    "branch_id"?: string;
                    "id"?: string;
                    "staff_id"?: string;
                    "valid_from"?: string;
                    "valid_to"?: string | null;
                };
                Relationships: [
                ];
            };
            "staff_day_metrics": {
                Row: {
                    "avg_rating": number | null;
                    "biz_id": string;
                    "branch_id": string;
                    "clients_count": number;
                    "created_at": string;
                    "day_score": number | null;
                    "id": string;
                    "late_minutes": number;
                    "metric_date": string;
                    "returning_clients_count": number;
                    "returning_clients_ratio": number | null;
                    "revenue": number;
                    "reviews_count": number;
                    "shifts_with_late": number;
                    "staff_id": string;
                    "total_shifts": number;
                    "updated_at": string;
                };
                ComputedFields: never;
                Insert: {
                    "avg_rating"?: number | null;
                    "biz_id": string;
                    "branch_id": string;
                    "clients_count"?: number;
                    "created_at"?: string;
                    "day_score"?: number | null;
                    "id"?: string;
                    "late_minutes"?: number;
                    "metric_date": string;
                    "returning_clients_count"?: number;
                    "returning_clients_ratio"?: number | null;
                    "revenue"?: number;
                    "reviews_count"?: number;
                    "shifts_with_late"?: number;
                    "staff_id": string;
                    "total_shifts"?: number;
                    "updated_at"?: string;
                };
                Update: {
                    "avg_rating"?: number | null;
                    "biz_id"?: string;
                    "branch_id"?: string;
                    "clients_count"?: number;
                    "created_at"?: string;
                    "day_score"?: number | null;
                    "id"?: string;
                    "late_minutes"?: number;
                    "metric_date"?: string;
                    "returning_clients_count"?: number;
                    "returning_clients_ratio"?: number | null;
                    "revenue"?: number;
                    "reviews_count"?: number;
                    "shifts_with_late"?: number;
                    "staff_id"?: string;
                    "total_shifts"?: number;
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "staff_day_metrics_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "staff_day_metrics_branch_id_fkey";
                        columns: [
                            "branch_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "branches";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "staff_day_metrics_staff_id_fkey";
                        columns: [
                            "staff_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "staff";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "staff_finance_operation_logs": {
                Row: {
                    "after_data": Json | null;
                    "before_data": Json | null;
                    "biz_id": string;
                    "created_at": string;
                    "error_message": string | null;
                    "error_stack": string | null;
                    "id": string;
                    "ip_address": unknown;
                    "log_level": string;
                    "message": string;
                    "metadata": Json | null;
                    "operation_type": string;
                    "shift_date": string | null;
                    "shift_id": string | null;
                    "staff_id": string;
                    "user_agent": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "after_data"?: Json | null;
                    "before_data"?: Json | null;
                    "biz_id": string;
                    "created_at"?: string;
                    "error_message"?: string | null;
                    "error_stack"?: string | null;
                    "id"?: string;
                    "ip_address"?: unknown;
                    "log_level"?: string;
                    "message": string;
                    "metadata"?: Json | null;
                    "operation_type": string;
                    "shift_date"?: string | null;
                    "shift_id"?: string | null;
                    "staff_id": string;
                    "user_agent"?: string | null;
                };
                Update: {
                    "after_data"?: Json | null;
                    "before_data"?: Json | null;
                    "biz_id"?: string;
                    "created_at"?: string;
                    "error_message"?: string | null;
                    "error_stack"?: string | null;
                    "id"?: string;
                    "ip_address"?: unknown;
                    "log_level"?: string;
                    "message"?: string;
                    "metadata"?: Json | null;
                    "operation_type"?: string;
                    "shift_date"?: string | null;
                    "shift_id"?: string | null;
                    "staff_id"?: string;
                    "user_agent"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "staff_finance_operation_logs_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "staff_finance_operation_logs_shift_id_fkey";
                        columns: [
                            "shift_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "staff_shifts";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "staff_finance_operation_logs_staff_id_fkey";
                        columns: [
                            "staff_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "staff";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "staff_home_branch_changes": {
                Row: {
                    "biz_id": string;
                    "created_at": string;
                    "created_by": string;
                    "effective_on": string;
                    "from_branch_id": string | null;
                    "id": number;
                    "staff_id": string;
                    "to_branch_id": string;
                    "transaction_id": number;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id": string;
                    "created_at"?: string;
                    "created_by": string;
                    "effective_on": string;
                    "from_branch_id"?: string | null;
                    "id"?: never;
                    "staff_id": string;
                    "to_branch_id": string;
                    "transaction_id"?: number;
                };
                Update: {
                    "biz_id"?: string;
                    "created_at"?: string;
                    "created_by"?: string;
                    "effective_on"?: string;
                    "from_branch_id"?: string | null;
                    "id"?: never;
                    "staff_id"?: string;
                    "to_branch_id"?: string;
                    "transaction_id"?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: "staff_home_branch_changes_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "staff_home_branch_changes_from_branch_id_fkey";
                        columns: [
                            "from_branch_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "branches";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "staff_home_branch_changes_staff_id_fkey";
                        columns: [
                            "staff_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "staff";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "staff_home_branch_changes_to_branch_id_fkey";
                        columns: [
                            "to_branch_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "branches";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "staff_invitations": {
                Row: {
                    "biz_id": string;
                    "created_at": string;
                    "decided_at": string | null;
                    "id": string;
                    "invited_by": string | null;
                    "invited_user_id": string;
                    "staff_id": string;
                    "status": string;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id": string;
                    "created_at"?: string;
                    "decided_at"?: string | null;
                    "id"?: string;
                    "invited_by"?: string | null;
                    "invited_user_id": string;
                    "staff_id": string;
                    "status"?: string;
                };
                Update: {
                    "biz_id"?: string;
                    "created_at"?: string;
                    "decided_at"?: string | null;
                    "id"?: string;
                    "invited_by"?: string | null;
                    "invited_user_id"?: string;
                    "staff_id"?: string;
                    "status"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "staff_invitations_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "staff_invitations_invited_by_fkey";
                        columns: [
                            "invited_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "staff_invitations_invited_user_id_fkey";
                        columns: [
                            "invited_user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "staff_invitations_staff_id_fkey";
                        columns: [
                            "staff_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "staff";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "staff_schedule_rules": {
                Row: {
                    "biz_id": string;
                    "branch_id": string;
                    "breaks": NonNullable<Json>;
                    "created_at": string | null;
                    "date_from": string | null;
                    "date_on": string | null;
                    "date_to": string | null;
                    "day_of_week": number | null;
                    "id": string;
                    "intervals": NonNullable<Json>;
                    "is_active": boolean;
                    "kind": Database["public"]['Enums']["schedule_rule_kind"];
                    "priority": number;
                    "staff_id": string;
                    "tz": string;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id": string;
                    "branch_id": string;
                    "breaks"?: NonNullable<Json>;
                    "created_at"?: string | null;
                    "date_from"?: string | null;
                    "date_on"?: string | null;
                    "date_to"?: string | null;
                    "day_of_week"?: number | null;
                    "id"?: string;
                    "intervals"?: NonNullable<Json>;
                    "is_active"?: boolean;
                    "kind": Database["public"]['Enums']["schedule_rule_kind"];
                    "priority"?: number;
                    "staff_id": string;
                    "tz"?: string;
                };
                Update: {
                    "biz_id"?: string;
                    "branch_id"?: string;
                    "breaks"?: NonNullable<Json>;
                    "created_at"?: string | null;
                    "date_from"?: string | null;
                    "date_on"?: string | null;
                    "date_to"?: string | null;
                    "day_of_week"?: number | null;
                    "id"?: string;
                    "intervals"?: NonNullable<Json>;
                    "is_active"?: boolean;
                    "kind"?: Database["public"]['Enums']["schedule_rule_kind"];
                    "priority"?: number;
                    "staff_id"?: string;
                    "tz"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "staff_schedule_rules_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "staff_schedule_rules_branch_id_fkey";
                        columns: [
                            "branch_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "branches";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "staff_schedule_rules_staff_id_fkey";
                        columns: [
                            "staff_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "staff";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "staff_schedule_versions": {
                Row: {
                    "biz_id": string;
                    "branch_id": string;
                    "created_at": string;
                    "created_by": string;
                    "days": NonNullable<Json>;
                    "effective_from": string;
                    "id": string;
                    "kind": string;
                    "revision": number;
                    "staff_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id": string;
                    "branch_id": string;
                    "created_at"?: string;
                    "created_by": string;
                    "days": NonNullable<Json>;
                    "effective_from": string;
                    "id"?: string;
                    "kind": string;
                    "revision": number;
                    "staff_id": string;
                };
                Update: {
                    "biz_id"?: string;
                    "branch_id"?: string;
                    "created_at"?: string;
                    "created_by"?: string;
                    "days"?: NonNullable<Json>;
                    "effective_from"?: string;
                    "id"?: string;
                    "kind"?: string;
                    "revision"?: number;
                    "staff_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "staff_schedule_versions_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "staff_schedule_versions_branch_id_fkey";
                        columns: [
                            "branch_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "branches";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "staff_schedule_versions_staff_id_fkey";
                        columns: [
                            "staff_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "staff";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "staff_shift_aggregates": {
                Row: {
                    "biz_id": string;
                    "id": string;
                    "period_type": string;
                    "period_value": string;
                    "shifts_count": number;
                    "staff_id": string;
                    "total_amount": number;
                    "total_late_minutes": number;
                    "total_master": number;
                    "total_salon": number;
                    "updated_at": string;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id": string;
                    "id"?: string;
                    "period_type": string;
                    "period_value": string;
                    "shifts_count"?: number;
                    "staff_id": string;
                    "total_amount"?: number;
                    "total_late_minutes"?: number;
                    "total_master"?: number;
                    "total_salon"?: number;
                    "updated_at"?: string;
                };
                Update: {
                    "biz_id"?: string;
                    "id"?: string;
                    "period_type"?: string;
                    "period_value"?: string;
                    "shifts_count"?: number;
                    "staff_id"?: string;
                    "total_amount"?: number;
                    "total_late_minutes"?: number;
                    "total_master"?: number;
                    "total_salon"?: number;
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "staff_shift_aggregates_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "staff_shift_aggregates_staff_id_fkey";
                        columns: [
                            "staff_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "staff";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "staff_shift_close_attempts": {
                Row: {
                    "attempted_at": string;
                    "claim_token": string;
                    "lease_until": string;
                    "shift_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "attempted_at": string;
                    "claim_token": string;
                    "lease_until": string;
                    "shift_id": string;
                };
                Update: {
                    "attempted_at"?: string;
                    "claim_token"?: string;
                    "lease_until"?: string;
                    "shift_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "staff_shift_close_attempts_shift_id_fkey";
                        columns: [
                            "shift_id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "staff_shifts";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "staff_shift_expenses": {
                Row: {
                    "amount": number;
                    "created_at": string;
                    "id": string;
                    "shift_id": string;
                    "title": string;
                };
                ComputedFields: never;
                Insert: {
                    "amount"?: number;
                    "created_at"?: string;
                    "id"?: string;
                    "shift_id": string;
                    "title": string;
                };
                Update: {
                    "amount"?: number;
                    "created_at"?: string;
                    "id"?: string;
                    "shift_id"?: string;
                    "title"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "staff_shift_expenses_shift_id_fkey";
                        columns: [
                            "shift_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "staff_shifts";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "staff_shift_items": {
                Row: {
                    "booking_id": string | null;
                    "client_name": string | null;
                    "consumables_amount": number;
                    "created_at": string;
                    "id": string;
                    "note": string | null;
                    "service_amount": number;
                    "service_name": string | null;
                    "shift_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "booking_id"?: string | null;
                    "client_name"?: string | null;
                    "consumables_amount"?: number;
                    "created_at"?: string;
                    "id"?: string;
                    "note"?: string | null;
                    "service_amount"?: number;
                    "service_name"?: string | null;
                    "shift_id": string;
                };
                Update: {
                    "booking_id"?: string | null;
                    "client_name"?: string | null;
                    "consumables_amount"?: number;
                    "created_at"?: string;
                    "id"?: string;
                    "note"?: string | null;
                    "service_amount"?: number;
                    "service_name"?: string | null;
                    "shift_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "staff_shift_items_booking_id_fkey";
                        columns: [
                            "booking_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "bookings";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "staff_shift_items_shift_id_fkey";
                        columns: [
                            "shift_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "staff_shifts";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "staff_shifts": {
                Row: {
                    "biz_id": string;
                    "branch_id": string;
                    "closed_at": string | null;
                    "consumables_amount": number;
                    "created_at": string;
                    "expected_start": string | null;
                    "guaranteed_amount": number;
                    "hourly_rate": number | null;
                    "hours_worked": number | null;
                    "id": string;
                    "late_minutes": number;
                    "ledger_revision": number;
                    "master_share": number;
                    "opened_at": string | null;
                    "percent_master": number;
                    "percent_salon": number;
                    "reopen_close_cap": string | null;
                    "reopened_at": string | null;
                    "salon_share": number;
                    "shift_date": string;
                    "staff_id": string;
                    "status": string;
                    "topup_amount": number;
                    "total_amount": number;
                    "updated_at": string;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id": string;
                    "branch_id": string;
                    "closed_at"?: string | null;
                    "consumables_amount"?: number;
                    "created_at"?: string;
                    "expected_start"?: string | null;
                    "guaranteed_amount"?: number;
                    "hourly_rate"?: number | null;
                    "hours_worked"?: number | null;
                    "id"?: string;
                    "late_minutes"?: number;
                    "ledger_revision"?: number;
                    "master_share"?: number;
                    "opened_at"?: string | null;
                    "percent_master"?: number;
                    "percent_salon"?: number;
                    "reopen_close_cap"?: string | null;
                    "reopened_at"?: string | null;
                    "salon_share"?: number;
                    "shift_date": string;
                    "staff_id": string;
                    "status"?: string;
                    "topup_amount"?: number;
                    "total_amount"?: number;
                    "updated_at"?: string;
                };
                Update: {
                    "biz_id"?: string;
                    "branch_id"?: string;
                    "closed_at"?: string | null;
                    "consumables_amount"?: number;
                    "created_at"?: string;
                    "expected_start"?: string | null;
                    "guaranteed_amount"?: number;
                    "hourly_rate"?: number | null;
                    "hours_worked"?: number | null;
                    "id"?: string;
                    "late_minutes"?: number;
                    "ledger_revision"?: number;
                    "master_share"?: number;
                    "opened_at"?: string | null;
                    "percent_master"?: number;
                    "percent_salon"?: number;
                    "reopen_close_cap"?: string | null;
                    "reopened_at"?: string | null;
                    "salon_share"?: number;
                    "shift_date"?: string;
                    "staff_id"?: string;
                    "status"?: string;
                    "topup_amount"?: number;
                    "total_amount"?: number;
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "staff_shifts_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "staff_shifts_branch_id_fkey";
                        columns: [
                            "branch_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "branches";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "staff_shifts_staff_id_fkey";
                        columns: [
                            "staff_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "staff";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "staff_time_off": {
                Row: {
                    "biz_id": string;
                    "cancelled_at": string | null;
                    "cancelled_by": string | null;
                    "created_at": string | null;
                    "created_by": string | null;
                    "date_from": string;
                    "date_to": string;
                    "id": string;
                    "reason": string | null;
                    "staff_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id": string;
                    "cancelled_at"?: string | null;
                    "cancelled_by"?: string | null;
                    "created_at"?: string | null;
                    "created_by"?: string | null;
                    "date_from": string;
                    "date_to": string;
                    "id"?: string;
                    "reason"?: string | null;
                    "staff_id": string;
                };
                Update: {
                    "biz_id"?: string;
                    "cancelled_at"?: string | null;
                    "cancelled_by"?: string | null;
                    "created_at"?: string | null;
                    "created_by"?: string | null;
                    "date_from"?: string;
                    "date_to"?: string;
                    "id"?: string;
                    "reason"?: string | null;
                    "staff_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "staff_time_off_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "staff_time_off_staff_id_fkey";
                        columns: [
                            "staff_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "staff";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "super_admins_legacy": {
                Row: {
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "user_id": string;
                };
                Update: {
                    "user_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "super_admins_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "telegram_auth_audit_log": {
                Row: {
                    "created_at": string;
                    "decision": string | null;
                    "event_type": string;
                    "id": string;
                    "linkage": string | null;
                    "metadata": NonNullable<Json>;
                    "nonce": string | null;
                    "reason": string | null;
                    "status": string | null;
                    "telegram_id": number | null;
                    "user_id": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string;
                    "decision"?: string | null;
                    "event_type": string;
                    "id"?: string;
                    "linkage"?: string | null;
                    "metadata"?: NonNullable<Json>;
                    "nonce"?: string | null;
                    "reason"?: string | null;
                    "status"?: string | null;
                    "telegram_id"?: number | null;
                    "user_id"?: string | null;
                };
                Update: {
                    "created_at"?: string;
                    "decision"?: string | null;
                    "event_type"?: string;
                    "id"?: string;
                    "linkage"?: string | null;
                    "metadata"?: NonNullable<Json>;
                    "nonce"?: string | null;
                    "reason"?: string | null;
                    "status"?: string | null;
                    "telegram_id"?: number | null;
                    "user_id"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "telegram_auth_audit_log_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "telegram_mobile_auth_attempts": {
                Row: {
                    "code_challenge": string | null;
                    "consumed_at": string | null;
                    "created_at": string;
                    "exchange_code": string | null;
                    "expires_at": string;
                    "id": string;
                    "linkage": string | null;
                    "nonce": string;
                    "source": Json | null;
                    "status": string;
                    "telegram_context": Json | null;
                    "telegram_id": number | null;
                    "user_id": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "code_challenge"?: string | null;
                    "consumed_at"?: string | null;
                    "created_at"?: string;
                    "exchange_code"?: string | null;
                    "expires_at": string;
                    "id"?: string;
                    "linkage"?: string | null;
                    "nonce": string;
                    "source"?: Json | null;
                    "status": string;
                    "telegram_context"?: Json | null;
                    "telegram_id"?: number | null;
                    "user_id"?: string | null;
                };
                Update: {
                    "code_challenge"?: string | null;
                    "consumed_at"?: string | null;
                    "created_at"?: string;
                    "exchange_code"?: string | null;
                    "expires_at"?: string;
                    "id"?: string;
                    "linkage"?: string | null;
                    "nonce"?: string;
                    "source"?: Json | null;
                    "status"?: string;
                    "telegram_context"?: Json | null;
                    "telegram_id"?: number | null;
                    "user_id"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "telegram_mobile_auth_attempts_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "telegram_profile_link_attempts": {
                Row: {
                    "created_at": string;
                    "expires_at": string;
                    "owner_id": string;
                    "status": string;
                    "telegram_id": number | null;
                    "telegram_name": string | null;
                    "telegram_username": string | null;
                    "token_hash": string;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string;
                    "expires_at"?: string;
                    "owner_id": string;
                    "status"?: string;
                    "telegram_id"?: number | null;
                    "telegram_name"?: string | null;
                    "telegram_username"?: string | null;
                    "token_hash": string;
                };
                Update: {
                    "created_at"?: string;
                    "expires_at"?: string;
                    "owner_id"?: string;
                    "status"?: string;
                    "telegram_id"?: number | null;
                    "telegram_name"?: string | null;
                    "telegram_username"?: string | null;
                    "token_hash"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "telegram_profile_link_attempts_owner_id_fkey";
                        columns: [
                            "owner_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "telegram_web_login_attempts": {
                Row: {
                    "browser_hash": string;
                    "created_at": string;
                    "expires_at": string;
                    "status": string;
                    "telegram_id": number | null;
                    "telegram_name": string | null;
                    "token_hash": string;
                };
                ComputedFields: never;
                Insert: {
                    "browser_hash": string;
                    "created_at"?: string;
                    "expires_at"?: string;
                    "status"?: string;
                    "telegram_id"?: number | null;
                    "telegram_name"?: string | null;
                    "token_hash": string;
                };
                Update: {
                    "browser_hash"?: string;
                    "created_at"?: string;
                    "expires_at"?: string;
                    "status"?: string;
                    "telegram_id"?: number | null;
                    "telegram_name"?: string | null;
                    "token_hash"?: string;
                };
                Relationships: [
                ];
            };
            "user_current_business": {
                Row: {
                    "biz_id": string;
                    "updated_at": string;
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id": string;
                    "updated_at"?: string;
                    "user_id": string;
                };
                Update: {
                    "biz_id"?: string;
                    "updated_at"?: string;
                    "user_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "user_current_business_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "user_current_business_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "user_global_roles": {
                Row: {
                    "created_at": string | null;
                    "role_id": string;
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string | null;
                    "role_id": string;
                    "user_id": string;
                };
                Update: {
                    "created_at"?: string | null;
                    "role_id"?: string;
                    "user_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "user_global_roles_role_id_fkey";
                        columns: [
                            "role_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "roles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "user_global_roles_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "user_lifecycle_commands": {
                Row: {
                    "action": string;
                    "actor_id": string;
                    "command_id": string;
                    "completed": boolean;
                    "completed_at": string | null;
                    "created_at": string;
                    "reason": string | null;
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "action": string;
                    "actor_id": string;
                    "command_id"?: string;
                    "completed"?: boolean;
                    "completed_at"?: string | null;
                    "created_at"?: string;
                    "reason"?: string | null;
                    "user_id": string;
                };
                Update: {
                    "action"?: string;
                    "actor_id"?: string;
                    "command_id"?: string;
                    "completed"?: boolean;
                    "completed_at"?: string | null;
                    "created_at"?: string;
                    "reason"?: string | null;
                    "user_id"?: string;
                };
                Relationships: [
                ];
            };
            "user_notification_email_sources": {
                Row: {
                    "created_at": string;
                    "email_id": string;
                    "provider_subject": string | null;
                    "source": string;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string;
                    "email_id": string;
                    "provider_subject"?: string | null;
                    "source": string;
                };
                Update: {
                    "created_at"?: string;
                    "email_id"?: string;
                    "provider_subject"?: string | null;
                    "source"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "user_notification_email_sources_email_id_fkey";
                        columns: [
                            "email_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "user_notification_emails";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "user_notification_emails": {
                Row: {
                    "created_at": string;
                    "email": string;
                    "enabled": boolean;
                    "id": string;
                    "updated_at": string;
                    "user_id": string;
                    "verified": boolean;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string;
                    "email": string;
                    "enabled"?: boolean;
                    "id"?: string;
                    "updated_at"?: string;
                    "user_id": string;
                    "verified"?: boolean;
                };
                Update: {
                    "created_at"?: string;
                    "email"?: string;
                    "enabled"?: boolean;
                    "id"?: string;
                    "updated_at"?: string;
                    "user_id"?: string;
                    "verified"?: boolean;
                };
                Relationships: [
                    {
                        foreignKeyName: "user_notification_emails_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "user_roles": {
                Row: {
                    "biz_id": string | null;
                    "biz_key": string | null;
                    "id": string;
                    "role_id": string;
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id"?: string | null;
                    "biz_key"?: never;
                    "id"?: string;
                    "role_id": string;
                    "user_id": string;
                };
                Update: {
                    "biz_id"?: string | null;
                    "biz_key"?: never;
                    "id"?: string;
                    "role_id"?: string;
                    "user_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "user_roles_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "user_roles_role_fk";
                        columns: [
                            "role_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "roles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "user_roles_role_id_fkey";
                        columns: [
                            "role_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "roles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "user_roles_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "user_suspensions": {
                Row: {
                    "created_at": string;
                    "created_by": string | null;
                    "reason": string | null;
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string;
                    "created_by"?: string | null;
                    "reason"?: string | null;
                    "user_id": string;
                };
                Update: {
                    "created_at"?: string;
                    "created_by"?: string | null;
                    "reason"?: string | null;
                    "user_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "user_suspensions_created_by_fkey";
                        columns: [
                            "created_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "user_suspensions_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "visit_package_plans": {
                Row: {
                    "biz_id": string;
                    "branch_ids": (string)[] | null;
                    "created_at": string;
                    "discount_type": Database["public"]['Enums']["visit_package_discount_type"];
                    "discount_value": number;
                    "id": string;
                    "is_active": boolean;
                    "name_en": string | null;
                    "name_ky": string | null;
                    "name_ru": string;
                    "service_id": string | null;
                    "updated_at": string;
                    "validity_days": number;
                    "visit_count": number;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id": string;
                    "branch_ids"?: (string)[] | null;
                    "created_at"?: string;
                    "discount_type": Database["public"]['Enums']["visit_package_discount_type"];
                    "discount_value": number;
                    "id"?: string;
                    "is_active"?: boolean;
                    "name_en"?: string | null;
                    "name_ky"?: string | null;
                    "name_ru": string;
                    "service_id"?: string | null;
                    "updated_at"?: string;
                    "validity_days": number;
                    "visit_count": number;
                };
                Update: {
                    "biz_id"?: string;
                    "branch_ids"?: (string)[] | null;
                    "created_at"?: string;
                    "discount_type"?: Database["public"]['Enums']["visit_package_discount_type"];
                    "discount_value"?: number;
                    "id"?: string;
                    "is_active"?: boolean;
                    "name_en"?: string | null;
                    "name_ky"?: string | null;
                    "name_ru"?: string;
                    "service_id"?: string | null;
                    "updated_at"?: string;
                    "validity_days"?: number;
                    "visit_count"?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: "visit_package_plans_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "visit_package_plans_service_id_fkey";
                        columns: [
                            "service_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "services";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "whatsapp_inbox": {
                Row: {
                    "attempts": number;
                    "available_at": string;
                    "booking_number": number | null;
                    "command": string | null;
                    "command_receipt": Json | null;
                    "completed_at": string | null;
                    "created_at": string;
                    "id": string;
                    "last_error_code": string | null;
                    "lease_token": string | null;
                    "lease_until": string | null;
                    "message_id": string;
                    "message_text": string | null;
                    "message_type": string | null;
                    "payload_hash": string;
                    "provider_reply_id": string | null;
                    "provider_timestamp": string;
                    "pruned_at": string | null;
                    "receiver": string;
                    "reply_payload": Json | null;
                    "reply_started_at": string | null;
                    "sender": string | null;
                    "status": string;
                };
                ComputedFields: never;
                Insert: {
                    "attempts"?: number;
                    "available_at"?: string;
                    "booking_number"?: number | null;
                    "command"?: string | null;
                    "command_receipt"?: Json | null;
                    "completed_at"?: string | null;
                    "created_at"?: string;
                    "id"?: string;
                    "last_error_code"?: string | null;
                    "lease_token"?: string | null;
                    "lease_until"?: string | null;
                    "message_id": string;
                    "message_text"?: string | null;
                    "message_type"?: string | null;
                    "payload_hash": string;
                    "provider_reply_id"?: string | null;
                    "provider_timestamp": string;
                    "pruned_at"?: string | null;
                    "receiver": string;
                    "reply_payload"?: Json | null;
                    "reply_started_at"?: string | null;
                    "sender"?: string | null;
                    "status"?: string;
                };
                Update: {
                    "attempts"?: number;
                    "available_at"?: string;
                    "booking_number"?: number | null;
                    "command"?: string | null;
                    "command_receipt"?: Json | null;
                    "completed_at"?: string | null;
                    "created_at"?: string;
                    "id"?: string;
                    "last_error_code"?: string | null;
                    "lease_token"?: string | null;
                    "lease_until"?: string | null;
                    "message_id"?: string;
                    "message_text"?: string | null;
                    "message_type"?: string | null;
                    "payload_hash"?: string;
                    "provider_reply_id"?: string | null;
                    "provider_timestamp"?: string;
                    "pruned_at"?: string | null;
                    "receiver"?: string;
                    "reply_payload"?: Json | null;
                    "reply_started_at"?: string | null;
                    "sender"?: string | null;
                    "status"?: string;
                };
                Relationships: [
                ];
            };
            "whatsapp_messages": {
                Row: {
                    "biz_id": string | null;
                    "booking_id": string | null;
                    "client_id": string | null;
                    "created_at": string;
                    "from_phone": string;
                    "id": string;
                    "message_text": string | null;
                    "message_timestamp": string;
                    "message_type": string;
                    "processed": boolean | null;
                    "processed_at": string | null;
                    "raw_data": Json | null;
                    "to_phone": string | null;
                    "updated_at": string;
                    "whatsapp_message_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id"?: string | null;
                    "booking_id"?: string | null;
                    "client_id"?: string | null;
                    "created_at"?: string;
                    "from_phone": string;
                    "id"?: string;
                    "message_text"?: string | null;
                    "message_timestamp": string;
                    "message_type": string;
                    "processed"?: boolean | null;
                    "processed_at"?: string | null;
                    "raw_data"?: Json | null;
                    "to_phone"?: string | null;
                    "updated_at"?: string;
                    "whatsapp_message_id": string;
                };
                Update: {
                    "biz_id"?: string | null;
                    "booking_id"?: string | null;
                    "client_id"?: string | null;
                    "created_at"?: string;
                    "from_phone"?: string;
                    "id"?: string;
                    "message_text"?: string | null;
                    "message_timestamp"?: string;
                    "message_type"?: string;
                    "processed"?: boolean | null;
                    "processed_at"?: string | null;
                    "raw_data"?: Json | null;
                    "to_phone"?: string | null;
                    "updated_at"?: string;
                    "whatsapp_message_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "whatsapp_messages_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "whatsapp_messages_booking_id_fkey";
                        columns: [
                            "booking_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "bookings";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "whatsapp_messages_client_id_fkey";
                        columns: [
                            "client_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "whatsapp_otp_codes": {
                Row: {
                    "code": string;
                    "code_challenge": string | null;
                    "consumed_at": string | null;
                    "created_at": string;
                    "expires_at": string;
                    "failed_attempts": number;
                    "id": string;
                    "locked_until": string | null;
                    "otp_hash": string | null;
                    "phone": string;
                    "phone_hash": string | null;
                    "phone_masked": string | null;
                    "status": string;
                    "used_at": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "code": string;
                    "code_challenge"?: string | null;
                    "consumed_at"?: string | null;
                    "created_at"?: string;
                    "expires_at": string;
                    "failed_attempts"?: number;
                    "id"?: string;
                    "locked_until"?: string | null;
                    "otp_hash"?: string | null;
                    "phone": string;
                    "phone_hash"?: string | null;
                    "phone_masked"?: string | null;
                    "status"?: string;
                    "used_at"?: string | null;
                };
                Update: {
                    "code"?: string;
                    "code_challenge"?: string | null;
                    "consumed_at"?: string | null;
                    "created_at"?: string;
                    "expires_at"?: string;
                    "failed_attempts"?: number;
                    "id"?: string;
                    "locked_until"?: string | null;
                    "otp_hash"?: string | null;
                    "phone"?: string;
                    "phone_hash"?: string | null;
                    "phone_masked"?: string | null;
                    "status"?: string;
                    "used_at"?: string | null;
                };
                Relationships: [
                ];
            };
            "working_hours": {
                Row: {
                    "biz_id": string;
                    "breaks": NonNullable<Json>;
                    "day_of_week": number;
                    "exceptions": NonNullable<Json>;
                    "id": string;
                    "intervals": NonNullable<Json>;
                    "staff_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "biz_id": string;
                    "breaks"?: NonNullable<Json>;
                    "day_of_week": number;
                    "exceptions"?: NonNullable<Json>;
                    "id"?: string;
                    "intervals"?: NonNullable<Json>;
                    "staff_id": string;
                };
                Update: {
                    "biz_id"?: string;
                    "breaks"?: NonNullable<Json>;
                    "day_of_week"?: number;
                    "exceptions"?: NonNullable<Json>;
                    "id"?: string;
                    "intervals"?: NonNullable<Json>;
                    "staff_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "working_hours_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "working_hours_staff_id_fkey";
                        columns: [
                            "staff_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "staff";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "yandex_oauth_states": {
                Row: {
                    "expires_at": string;
                    "flow": string;
                    "return_path": string;
                    "state_hash": string;
                    "user_id": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "expires_at"?: string;
                    "flow": string;
                    "return_path"?: string;
                    "state_hash": string;
                    "user_id"?: string | null;
                };
                Update: {
                    "expires_at"?: string;
                    "flow"?: string;
                    "return_path"?: string;
                    "state_hash"?: string;
                    "user_id"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "yandex_oauth_states_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
        };
        Views: {
            "auth_users_view": {
                Row: {
                    "created_at": string | null;
                    "email": string | null;
                    "full_name": string | null;
                    "id": string;
                    "is_suspended": boolean | null;
                    "phone": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string | null;
                    "email"?: string | null;
                    "full_name"?: never;
                    "id"?: string | null;
                    "is_suspended"?: never;
                    "phone"?: string | null;
                };
                Update: {
                    "created_at"?: string | null;
                    "email"?: string | null;
                    "full_name"?: never;
                    "id"?: string | null;
                    "is_suspended"?: never;
                    "phone"?: string | null;
                };
                Relationships: [
                ];
            };
            "current_staff_branch": {
                Row: {
                    "branch_id": string;
                    "staff_id": string;
                };
                ComputedFields: never;
                Relationships: [
                ];
            };
            "current_user_roles": {
                Row: {
                    "biz_id": string | null;
                    "role_key": string;
                    "user_id": string;
                };
                ComputedFields: never;
                Relationships: [
                    {
                        foreignKeyName: "user_roles_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "user_roles_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "geography_columns": {
                Row: {
                    "coord_dimension": number | null;
                    "f_geography_column": unknown;
                    "f_table_catalog": unknown;
                    "f_table_name": unknown;
                    "f_table_schema": unknown;
                    "srid": number | null;
                    "type": string | null;
                };
                ComputedFields: never;
                Relationships: [
                ];
            };
            "geometry_columns": {
                Row: {
                    "coord_dimension": number | null;
                    "f_geometry_column": unknown;
                    "f_table_catalog": string | null;
                    "f_table_name": unknown;
                    "f_table_schema": unknown;
                    "srid": number | null;
                    "type": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "coord_dimension"?: number | null;
                    "f_geometry_column"?: unknown;
                    "f_table_catalog"?: string | null;
                    "f_table_name"?: unknown;
                    "f_table_schema"?: unknown;
                    "srid"?: number | null;
                    "type"?: string | null;
                };
                Update: {
                    "coord_dimension"?: number | null;
                    "f_geometry_column"?: unknown;
                    "f_table_catalog"?: string | null;
                    "f_table_name"?: unknown;
                    "f_table_schema"?: unknown;
                    "srid"?: number | null;
                    "type"?: string | null;
                };
                Relationships: [
                ];
            };
            "user_roles_legacy": {
                Row: {
                    "biz_id": string | null;
                    "role": string;
                    "user_id": string;
                };
                ComputedFields: never;
                Relationships: [
                    {
                        foreignKeyName: "user_roles_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "user_roles_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "user_roles_with_user": {
                Row: {
                    "biz_id": string | null;
                    "email": string | null;
                    "full_name": string | null;
                    "phone": string | null;
                    "role_key": string;
                    "role_name": string;
                    "user_id": string;
                };
                ComputedFields: never;
                Relationships: [
                    {
                        foreignKeyName: "user_roles_biz_id_fkey";
                        columns: [
                            "biz_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "user_roles_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "auth_users_view";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
        };
        Functions: {
            "_assert_booking_transition_access": {
                Args: {
                    "p_booking_id": string;
                };
                Returns: {
                    "biz_id": string;
                    "branch_id": string;
                    "client_email": string | null;
                    "client_id": string | null;
                    "client_name": string | null;
                    "client_phone": string | null;
                    "created_at": string | null;
                    "end_at": string;
                    "expires_at": string | null;
                    "id": string;
                    "notification_revision": number;
                    "promotion_applied": Json | null;
                    "service_id": string;
                    "source": string | null;
                    "staff_id": string;
                    "start_at": string;
                    "status": Database["public"]['Enums']["booking_status"];
                    "subscription_applied": Json | null;
                    "time_range": unknown;
                };
                SetofOptions: {
                    from: "*";
                    to: "bookings";
                    isOneToOne: true;
                    isSetofReturn: false;
                };
            };
            "_assert_internal_booking_access": {
                Args: {
                    "p_biz_id": string;
                    "p_branch_id": string;
                    "p_staff_id": string;
                };
                Returns: undefined;
            };
            "_claim_booking_notifications": {
                Args: {
                    "p_exclude_ids": (string)[];
                    "p_lease_seconds": number;
                    "p_limit": number;
                };
                Returns: {
                    "attempts": number;
                    "available_at": string;
                    "booking_id": string;
                    "booking_revision": number;
                    "completed_at": string | null;
                    "created_at": string;
                    "event_type": string;
                    "id": string;
                    "last_error_code": string | null;
                    "lease_token": string | null;
                    "lease_until": string | null;
                    "payloads_pruned_at": string | null;
                    "prepared_at": string | null;
                    "status": string;
                }[];
                SetofOptions: {
                    from: "*";
                    to: "booking_notification_outbox";
                    isOneToOne: false;
                    isSetofReturn: true;
                };
            };
            "_confirm_booking_transition": {
                Args: {
                    "p_booking_id": string;
                };
                Returns: undefined;
            };
            "_confirm_created_booking": {
                Args: {
                    "p_actor_id": string;
                    "p_booking_id": string;
                };
                Returns: undefined;
            };
            "_hold_complex_slot_for_actor": {
                Args: {
                    "p_actor_id": string;
                    "p_biz_id": string;
                    "p_branch_id": string;
                    "p_services": Json;
                    "p_staff_id": string;
                    "p_start": string;
                };
                Returns: string;
            };
            "_hold_slot_for_actor": {
                Args: {
                    "p_actor_id": string;
                    "p_biz_id": string;
                    "p_branch_id": string;
                    "p_service_id": string;
                    "p_staff_id": string;
                    "p_start": string;
                };
                Returns: string;
            };
            "_internal_booking_actor_allowed": {
                Args: {
                    "p_actor": string;
                    "p_biz": string;
                    "p_branch": string;
                    "p_staff": string;
                };
                Returns: boolean;
            };
            "_locked_whatsapp_inbox": {
                Args: {
                    "p_id": string;
                    "p_token": string;
                };
                Returns: {
                    "attempts": number;
                    "available_at": string;
                    "booking_number": number | null;
                    "command": string | null;
                    "command_receipt": Json | null;
                    "completed_at": string | null;
                    "created_at": string;
                    "id": string;
                    "last_error_code": string | null;
                    "lease_token": string | null;
                    "lease_until": string | null;
                    "message_id": string;
                    "message_text": string | null;
                    "message_type": string | null;
                    "payload_hash": string;
                    "provider_reply_id": string | null;
                    "provider_timestamp": string;
                    "pruned_at": string | null;
                    "receiver": string;
                    "reply_payload": Json | null;
                    "reply_started_at": string | null;
                    "sender": string | null;
                    "status": string;
                };
                SetofOptions: {
                    from: "*";
                    to: "whatsapp_inbox";
                    isOneToOne: true;
                    isSetofReturn: false;
                };
            };
            "_postgis_deprecate": {
                Args: {
                    "newname": string;
                    "oldname": string;
                    "version": string;
                };
                Returns: undefined;
            };
            "_postgis_index_extent": {
                Args: {
                    "col": string;
                    "tbl": unknown;
                };
                Returns: unknown;
            };
            "_postgis_pgsql_version": {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            "_postgis_scripts_pgsql_version": {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            "_postgis_selectivity": {
                Args: {
                    "att_name": string;
                    "geom": unknown;
                    "mode"?: string;
                    "tbl": unknown;
                };
                Returns: number;
            };
            "_postgis_stats": {
                Args: {
                    ""?: string;
                    "att_name": string;
                    "tbl": unknown;
                };
                Returns: string;
            };
            "_require_whatsapp_inbox_service": {
                Args: Record<PropertyKey, never>;
                Returns: undefined;
            };
            "_st_3dintersects": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "_st_contains": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "_st_containsproperly": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "_st_coveredby": {
                Args: {
                    "geog1": unknown;
                    "geog2": unknown;
                };
                Returns: boolean;
            } | {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "_st_covers": {
                Args: {
                    "geog1": unknown;
                    "geog2": unknown;
                };
                Returns: boolean;
            } | {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "_st_crosses": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "_st_dwithin": {
                Args: {
                    "geog1": unknown;
                    "geog2": unknown;
                    "tolerance": number;
                    "use_spheroid"?: boolean;
                };
                Returns: boolean;
            };
            "_st_equals": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "_st_intersects": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "_st_linecrossingdirection": {
                Args: {
                    "line1": unknown;
                    "line2": unknown;
                };
                Returns: number;
            };
            "_st_longestline": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: unknown;
            };
            "_st_maxdistance": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: number;
            };
            "_st_orderingequals": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "_st_overlaps": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "_st_sortablehash": {
                Args: {
                    "geom": unknown;
                };
                Returns: number;
            };
            "_st_touches": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "_st_voronoi": {
                Args: {
                    "clip"?: unknown;
                    "g1": unknown;
                    "return_polygons"?: boolean;
                    "tolerance"?: number;
                };
                Returns: unknown;
            };
            "_st_within": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "_staff_performs_service": {
                Args: {
                    "p_branch_id": string;
                    "p_service_id": string;
                    "p_staff_id": string;
                };
                Returns: boolean;
            };
            "accept_staff_invitation": {
                Args: {
                    "p_invitation_id": string;
                    "p_user_id": string;
                };
                Returns: Json;
            };
            "addauth": {
                Args: {
                    "": string;
                };
                Returns: boolean;
            };
            "addgeometrycolumn": {
                Args: {
                    "catalog_name": string;
                    "column_name": string;
                    "new_dim": number;
                    "new_srid_in": number;
                    "new_type": string;
                    "schema_name": string;
                    "table_name": string;
                    "use_typmod"?: boolean;
                };
                Returns: string;
            } | {
                Args: {
                    "column_name": string;
                    "new_dim": number;
                    "new_srid": number;
                    "new_type": string;
                    "schema_name": string;
                    "table_name": string;
                    "use_typmod"?: boolean;
                };
                Returns: string;
            } | {
                Args: {
                    "column_name": string;
                    "new_dim": number;
                    "new_srid": number;
                    "new_type": string;
                    "table_name": string;
                    "use_typmod"?: boolean;
                };
                Returns: string;
            };
            "adjust_closed_shift_hours_command": {
                Args: {
                    "p_actor_id": string;
                    "p_biz_id": string;
                    "p_calculation": Json;
                    "p_expected_revision": number;
                    "p_hours_worked": number;
                    "p_shift_id": string;
                };
                Returns: Json;
            };
            "admin_list_users": {
                Args: {
                    "p_actor_id": string;
                    "p_limit"?: number;
                    "p_offset"?: number;
                    "p_q"?: string;
                    "p_status"?: string;
                };
                Returns: Json;
            };
            "admin_user_stats": {
                Args: {
                    "p_actor_id": string;
                };
                Returns: Json;
            };
            "anonymize_inactive_profiles_pii": {
                Args: {
                    "p_inactive_days"?: number;
                };
                Returns: number;
            };
            "anonymize_old_bookings_pii": {
                Args: {
                    "p_older_than_days"?: number;
                };
                Returns: number;
            };
            "apply_promotion_to_booking": {
                Args: {
                    "p_booking_id": string;
                };
                Returns: Json;
            };
            "apply_visit_package_to_booking": {
                Args: {
                    "p_booking_id": string;
                };
                Returns: Json;
            };
            "apply_visit_package_to_booking_impl_20261109": {
                Args: {
                    "p_booking_id": string;
                };
                Returns: Json;
            };
            "approve_staff_application": {
                Args: {
                    "p_application_id": string;
                    "p_branch_id": string;
                    "p_is_active"?: boolean;
                    "p_reviewer_user_id": string;
                };
                Returns: {
                    "biz_id": string;
                    "branch_id": string;
                    "staff_id": string;
                }[];
            };
            "assert_booking_finance_access": {
                Args: {
                    "p_booking_id": string;
                };
                Returns: undefined;
            };
            "assert_finance_access": {
                Args: {
                    "p_actor_id"?: string;
                    "p_biz_id": string;
                    "p_staff_id"?: string;
                };
                Returns: undefined;
            };
            "begin_booking_notification_delivery": {
                Args: {
                    "p_delivery_key": string;
                    "p_event_id": string;
                    "p_lease_token": string;
                };
                Returns: string;
            };
            "begin_whatsapp_inbox_reply": {
                Args: {
                    "p_id": string;
                    "p_token": string;
                };
                Returns: undefined;
            };
            "booking_notification_backlog_health": {
                Args: Record<PropertyKey, never>;
                Returns: Json;
            };
            "booking_receipt_public": {
                Args: {
                    "p_id": string;
                };
                Returns: {
                    "end_at": string;
                    "id": string;
                    "services": Json;
                    "staff_name": string;
                    "start_at": string;
                    "status": Database["public"]['Enums']["booking_status"];
                    "tz": string;
                }[];
            };
            "branch_admins_effective": {
                Args: {
                    "p_branch_id": string;
                };
                Returns: {
                    "source": string;
                    "user_id": string;
                }[];
            };
            "calculate_biz_day_metrics": {
                Args: {
                    "p_biz_id": string;
                    "p_metric_date": string;
                };
                Returns: undefined;
            };
            "calculate_biz_rating": {
                Args: {
                    "p_biz_id": string;
                };
                Returns: number;
            };
            "calculate_branch_day_metrics": {
                Args: {
                    "p_branch_id": string;
                    "p_metric_date": string;
                };
                Returns: undefined;
            };
            "calculate_branch_rating": {
                Args: {
                    "p_branch_id": string;
                };
                Returns: number;
            };
            "calculate_staff_day_metrics": {
                Args: {
                    "p_metric_date": string;
                    "p_staff_id": string;
                };
                Returns: undefined;
            };
            "calculate_staff_rating": {
                Args: {
                    "p_staff_id": string;
                };
                Returns: number;
            };
            "can_edit_review": {
                Args: {
                    "p_id": string;
                };
                Returns: boolean;
            };
            "can_review": {
                Args: {
                    "p_booking_id": string;
                };
                Returns: boolean;
            };
            "can_use_promotion": {
                Args: {
                    "p_booking_id": string;
                    "p_branch_id": string;
                    "p_client_id": string;
                    "p_promotion_id": string;
                };
                Returns: boolean;
            };
            "cancel_booking": {
                Args: {
                    "p_booking_id": string;
                };
                Returns: undefined;
            };
            "cancel_business_role_application": {
                Args: {
                    "p_application_id": string;
                    "p_user_id": string;
                };
                Returns: boolean;
            };
            "cat_remove_slug": {
                Args: {
                    "the_slug": string;
                };
                Returns: number;
            };
            "cat_replace_slug": {
                Args: {
                    "new_slug": string;
                    "old_slug": string;
                };
                Returns: number;
            };
            "categories_with_usage_v2": {
                Args: Record<PropertyKey, never>;
                Returns: {
                    "id": string;
                    "is_active": boolean;
                    "name_ru": string;
                    "slug": string;
                    "usage_count": number;
                }[];
            };
            "check_user_lifecycle_request": {
                Args: Record<PropertyKey, never>;
                Returns: undefined;
            };
            "claim_booking_notification_batch": {
                Args: {
                    "p_exclude_ids": (string)[];
                    "p_lease_seconds": number;
                    "p_limit": number;
                };
                Returns: Json;
            };
            "claim_overdue_staff_shifts": {
                Args: {
                    "p_claim_token": string;
                    "p_limit"?: number;
                    "p_now"?: string;
                };
                Returns: Json;
            };
            "claim_whatsapp_inbox": {
                Args: {
                    "p_limit"?: number;
                    "p_receiver": string;
                };
                Returns: {
                    "attempts": number;
                    "id": string;
                    "lease_token": string;
                }[];
            };
            "cleanup_expired_telegram_mobile_auth_attempts": {
                Args: {
                    "p_keep_minutes"?: number;
                };
                Returns: number;
            };
            "cleanup_expired_whatsapp_otp_codes": {
                Args: {
                    "p_keep_minutes"?: number;
                };
                Returns: number;
            };
            "cleanup_old_api_metrics": {
                Args: {
                    "p_keep_days"?: number;
                };
                Returns: number;
            };
            "cleanup_old_finance_logs": {
                Args: {
                    "p_keep_days"?: number;
                };
                Returns: number;
            };
            "cleanup_old_funnel_events": {
                Args: {
                    "p_keep_days"?: number;
                };
                Returns: number;
            };
            "cleanup_telegram_profile_links": {
                Args: Record<PropertyKey, never>;
                Returns: undefined;
            };
            "close_staff_shift_command": {
                Args: {
                    "p_actor_id": string;
                    "p_calculation": Json;
                    "p_expected_revision": number;
                    "p_expected_settings": Json;
                    "p_shift_id": string;
                };
                Returns: Json;
            };
            "close_staff_shift_safe": {
                Args: {
                    "p_closed_at"?: string;
                    "p_consumables_amount"?: number;
                    "p_guaranteed_amount"?: number;
                    "p_hourly_rate"?: number;
                    "p_hours_worked"?: number;
                    "p_master_share"?: number;
                    "p_percent_master"?: number;
                    "p_percent_salon"?: number;
                    "p_salon_share"?: number;
                    "p_shift_id": string;
                    "p_topup_amount"?: number;
                    "p_total_amount"?: number;
                };
                Returns: Json;
            };
            "confirm_booking": {
                Args: {
                    "p_booking_id": string;
                };
                Returns: undefined;
            };
            "consume_mobile_session_grant": {
                Args: {
                    "p_code_challenge": string;
                    "p_code_hash": string;
                };
                Returns: string;
            };
            "consume_whatsapp_mobile_otp": {
                Args: {
                    "p_attempt_id": string;
                    "p_code_challenge": string;
                    "p_otp_hash": string;
                };
                Returns: boolean;
            };
            "consume_yandex_oauth_state": {
                Args: {
                    "p_flow": string;
                    "p_state_hash": string;
                    "p_user_id": string;
                };
                Returns: Json;
            };
            "create_confirmed_booking": {
                Args: {
                    "p_guest_secret"?: string;
                    "p_payload": Json;
                    "p_request_id": string;
                };
                Returns: Json;
            } | {
                Args: {
                    "p_actor_id": string;
                    "p_guest_secret": string;
                    "p_payload": Json;
                    "p_request_id": string;
                };
                Returns: Json;
            };
            "create_internal_booking": {
                Args: {
                    "p_biz_id": string;
                    "p_branch_id": string;
                    "p_client_id"?: string;
                    "p_client_name"?: string;
                    "p_client_phone"?: string;
                    "p_minutes": number;
                    "p_service_id": string;
                    "p_staff_id": string;
                    "p_start": string;
                };
                Returns: string;
            };
            "create_internal_booking_request": {
                Args: {
                    "p_actor_id": string;
                    "p_payload": Json;
                    "p_request_id": string;
                };
                Returns: Json;
            };
            "create_internal_complex_booking": {
                Args: {
                    "p_biz_id": string;
                    "p_branch_id": string;
                    "p_client_email"?: string;
                    "p_client_id"?: string;
                    "p_client_name"?: string;
                    "p_client_phone"?: string;
                    "p_services": Json;
                    "p_staff_id": string;
                    "p_start": string;
                };
                Returns: string;
            };
            "create_mobile_session_grant": {
                Args: {
                    "p_code_challenge": string;
                    "p_code_hash": string;
                    "p_user_id": string;
                };
                Returns: undefined;
            };
            "create_yandex_oauth_state": {
                Args: {
                    "p_flow": string;
                    "p_return_path": string;
                    "p_state_hash": string;
                    "p_user_id": string;
                };
                Returns: undefined;
            };
            "dashboard_bookings_page": {
                Args: {
                    "p_biz_id": string;
                    "p_branch_id"?: string;
                    "p_limit"?: number;
                    "p_offset"?: number;
                    "p_search"?: string;
                    "p_staff_id"?: string;
                    "p_start_before"?: string;
                    "p_start_from"?: string;
                    "p_status"?: string;
                };
                Returns: Json;
            };
            "decline_staff_invitation": {
                Args: {
                    "p_invitation_id": string;
                    "p_user_id": string;
                };
                Returns: undefined;
            };
            "delete_branch_without_history": {
                Args: {
                    "p_biz_id": string;
                    "p_branch_id": string;
                };
                Returns: undefined;
            };
            "delete_business_without_history": {
                Args: {
                    "p_biz_id": string;
                };
                Returns: undefined;
            };
            "delete_staff_without_history": {
                Args: {
                    "p_biz_id": string;
                    "p_staff_id": string;
                };
                Returns: undefined;
            };
            "disablelongtransactions": {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            "dropgeometrycolumn": {
                Args: {
                    "catalog_name": string;
                    "column_name": string;
                    "schema_name": string;
                    "table_name": string;
                };
                Returns: string;
            } | {
                Args: {
                    "column_name": string;
                    "schema_name": string;
                    "table_name": string;
                };
                Returns: string;
            } | {
                Args: {
                    "column_name": string;
                    "table_name": string;
                };
                Returns: string;
            };
            "dropgeometrytable": {
                Args: {
                    "catalog_name": string;
                    "schema_name": string;
                    "table_name": string;
                };
                Returns: string;
            } | {
                Args: {
                    "schema_name": string;
                    "table_name": string;
                };
                Returns: string;
            } | {
                Args: {
                    "table_name": string;
                };
                Returns: string;
            };
            "enablelongtransactions": {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            "enqueue_booking_notification": {
                Args: {
                    "p_booking_id": string;
                    "p_type": string;
                };
                Returns: string;
            };
            "equals": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "fail_booking_notification_delivery": {
                Args: {
                    "p_delivery_key": string;
                    "p_error_code": string;
                    "p_event_id": string;
                    "p_lease_token": string;
                    "p_outcome": string;
                };
                Returns: undefined;
            };
            "fail_whatsapp_inbox": {
                Args: {
                    "p_code": string;
                    "p_id": string;
                    "p_outcome": string;
                    "p_retry_after"?: number;
                    "p_token": string;
                };
                Returns: undefined;
            };
            "finalize_due_account_deletions": {
                Args: {
                    "batch_limit"?: number;
                };
                Returns: number;
            };
            "finance_business_timezone": {
                Args: {
                    "p_biz_id": string;
                };
                Returns: string;
            };
            "finance_can_manage_business": {
                Args: {
                    "p_actor_id": string;
                    "p_biz_id": string;
                };
                Returns: boolean;
            };
            "finance_is_platform_admin": {
                Args: {
                    "p_actor_id": string;
                };
                Returns: boolean;
            };
            "find_accounts_by_contact": {
                Args: {
                    "p_email"?: string;
                    "p_phone_digits"?: string;
                };
                Returns: {
                    "email": string;
                    "full_name": string;
                    "id": string;
                    "phone": string;
                }[];
            };
            "finish_booking_notification": {
                Args: {
                    "p_error_code"?: string;
                    "p_event_id": string;
                    "p_lease_token": string;
                    "p_outcome": string;
                    "p_retry_after_seconds"?: number;
                };
                Returns: undefined;
            };
            "finish_cron_execution": {
                Args: {
                    "p_error_code"?: string;
                    "p_http_status": number;
                    "p_id": string;
                    "p_outcome": string;
                };
                Returns: undefined;
            };
            "geometry": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "geometry_above": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "geometry_below": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "geometry_cmp": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: number;
            };
            "geometry_contained_3d": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "geometry_contains": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "geometry_contains_3d": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "geometry_distance_box": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: number;
            };
            "geometry_distance_centroid": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: number;
            };
            "geometry_eq": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "geometry_ge": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "geometry_gt": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "geometry_le": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "geometry_left": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "geometry_lt": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "geometry_overabove": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "geometry_overbelow": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "geometry_overlaps": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "geometry_overlaps_3d": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "geometry_overleft": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "geometry_overright": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "geometry_right": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "geometry_same": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "geometry_same_3d": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "geometry_within": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "geomfromewkt": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "get_api_metrics_stats": {
                Args: {
                    "p_endpoint": string;
                    "p_method"?: string;
                    "p_window_minutes"?: number;
                };
                Returns: Json;
            };
            "get_applicable_visit_package_for_booking": {
                Args: {
                    "p_booking_id": string;
                };
                Returns: string;
            };
            "get_business_finance_stats": {
                Args: {
                    "p_biz_id": string;
                    "p_branch_id"?: string;
                    "p_date_from": string;
                    "p_date_to": string;
                    "p_include_open"?: boolean;
                };
                Returns: Json;
            };
            "get_business_finance_stats_impl_20261109": {
                Args: {
                    "p_biz_id": string;
                    "p_branch_id"?: string;
                    "p_date_from": string;
                    "p_date_to": string;
                    "p_include_open"?: boolean;
                };
                Returns: Json;
            };
            "get_client_visit_count": {
                Args: {
                    "p_branch_id": string;
                    "p_client_id": string;
                    "p_exclude_booking_id": string;
                };
                Returns: number;
            };
            "get_free_slots_complex_day_v1": {
                Args: {
                    "p_biz_id": string;
                    "p_branch_id": string;
                    "p_day": string;
                    "p_duration_min": number;
                    "p_per_staff"?: number;
                    "p_staff_id": string;
                    "p_step_min"?: number;
                };
                Returns: {
                    "branch_id": string;
                    "end_at": string;
                    "staff_id": string;
                    "start_at": string;
                }[];
            };
            "get_free_slots_page_v1": {
                Args: {
                    "p_biz_id": string;
                    "p_branch_id": string;
                    "p_cursor": Json;
                    "p_day": string;
                    "p_duration_min": number;
                    "p_limit"?: number;
                    "p_service_id": string;
                    "p_service_ids"?: (string)[];
                    "p_staff_id": string;
                };
                Returns: Json;
            };
            "get_free_slots_service_day": {
                Args: {
                    "p_biz_id": string;
                    "p_day": string;
                    "p_per_staff"?: number;
                    "p_service_id": string;
                    "p_step_min"?: number;
                    "p_tz"?: string;
                };
                Returns: {
                    "end_at": string;
                    "staff_id": string;
                    "start_at": string;
                }[];
            };
            "get_free_slots_service_day_v2": {
                Args: {
                    "p_biz_id": string;
                    "p_day": string;
                    "p_per_staff"?: number;
                    "p_service_id": string;
                    "p_step_min"?: number;
                };
                Returns: {
                    "branch_id": string;
                    "end_at": string;
                    "staff_id": string;
                    "start_at": string;
                }[];
            } | {
                Args: {
                    "p_biz_id": string;
                    "p_day": string;
                    "p_per_staff": number;
                    "p_service_id": string;
                    "p_staff_id": string;
                    "p_step_min": number;
                };
                Returns: {
                    "branch_id": string;
                    "end_at": string;
                    "staff_id": string;
                    "start_at": string;
                }[];
            };
            "get_my_notification_emails": {
                Args: Record<PropertyKey, never>;
                Returns: {
                    "email": string;
                    "enabled": boolean;
                    "sources": (string)[];
                    "verified": boolean;
                }[];
            };
            "get_staff_finance_stats": {
                Args: {
                    "p_biz_id": string;
                    "p_date_from": string;
                    "p_date_to": string;
                    "p_include_open"?: boolean;
                    "p_staff_id": string;
                };
                Returns: Json;
            };
            "get_staff_finance_stats_impl_20261109": {
                Args: {
                    "p_biz_id": string;
                    "p_date_from": string;
                    "p_date_to": string;
                    "p_include_open"?: boolean;
                    "p_staff_id": string;
                };
                Returns: Json;
            };
            "gettransactionid": {
                Args: Record<PropertyKey, never>;
                Returns: unknown;
            };
            "grant_branch_admin": {
                Args: {
                    "p_branch_id": string;
                    "p_user_id": string;
                };
                Returns: undefined;
            };
            "has_branch_admin": {
                Args: {
                    "p_branch_id": string;
                };
                Returns: boolean;
            };
            "has_role": {
                Args: {
                    "p_biz_id"?: string;
                    "p_role_key": string;
                };
                Returns: boolean;
            } | {
                Args: {
                    "p_biz_id": string;
                    "p_role_key": string;
                    "p_user_id": string;
                };
                Returns: boolean;
            };
            "hold_complex_slot": {
                Args: {
                    "p_biz_id": string;
                    "p_branch_id": string;
                    "p_services": Json;
                    "p_staff_id": string;
                    "p_start": string;
                };
                Returns: string;
            };
            "hold_complex_slot_guest": {
                Args: {
                    "p_biz_id": string;
                    "p_branch_id": string;
                    "p_client_email"?: string;
                    "p_client_name": string;
                    "p_client_phone": string;
                    "p_services": Json;
                    "p_staff_id": string;
                    "p_start": string;
                };
                Returns: string;
            };
            "hold_slot": {
                Args: {
                    "p_biz_id": string;
                    "p_branch_id": string;
                    "p_service_id": string;
                    "p_staff_id": string;
                    "p_start": string;
                };
                Returns: string;
            };
            "hold_slot_guest": {
                Args: {
                    "p_biz_id": string;
                    "p_branch_id": string;
                    "p_client_email"?: string;
                    "p_client_name": string;
                    "p_client_phone": string;
                    "p_service_id": string;
                    "p_staff_id": string;
                    "p_start": string;
                };
                Returns: string;
            };
            "initialize_all_ratings": {
                Args: {
                    "p_days_back"?: number;
                };
                Returns: undefined;
            };
            "is_super_admin": {
                Args: Record<PropertyKey, never>;
                Returns: boolean;
            };
            "log_api_metric": {
                Args: {
                    "p_biz_id"?: string;
                    "p_duration_ms": number;
                    "p_endpoint": string;
                    "p_error_message"?: string;
                    "p_error_type"?: string;
                    "p_ip_address"?: unknown;
                    "p_metadata"?: Json;
                    "p_method": string;
                    "p_request_size_bytes"?: number;
                    "p_response_size_bytes"?: number;
                    "p_staff_id"?: string;
                    "p_status_code": number;
                    "p_user_agent"?: string;
                    "p_user_id"?: string;
                };
                Returns: string;
            };
            "log_finance_operation": {
                Args: {
                    "p_after_data"?: Json;
                    "p_before_data"?: Json;
                    "p_biz_id": string;
                    "p_error_message"?: string;
                    "p_error_stack"?: string;
                    "p_ip_address"?: unknown;
                    "p_log_level"?: string;
                    "p_message": string;
                    "p_metadata"?: Json;
                    "p_operation_type": string;
                    "p_shift_date"?: string;
                    "p_shift_id"?: string;
                    "p_staff_id": string;
                    "p_user_agent"?: string;
                };
                Returns: string;
            };
            "longtransactionsenabled": {
                Args: Record<PropertyKey, never>;
                Returns: boolean;
            };
            "mark_booking_attendance_command": {
                Args: {
                    "p_actor_id": string;
                    "p_attended": boolean;
                    "p_biz_id": string;
                    "p_booking_id": string;
                };
                Returns: Json;
            };
            "members_of_biz": {
                Args: {
                    "p_biz_id": string;
                };
                Returns: {
                    "email": string;
                    "full_name": string;
                    "phone": string;
                    "roles": (string)[];
                    "user_id": string;
                }[];
            };
            "my_role_keys": {
                Args: Record<PropertyKey, never>;
                Returns: (string)[];
            };
            "open_staff_shift_safe": {
                Args: {
                    "p_biz_id": string;
                    "p_branch_id": string;
                    "p_expected_start"?: string;
                    "p_late_minutes"?: number;
                    "p_opened_at": string;
                    "p_shift_date": string;
                    "p_staff_id": string;
                };
                Returns: Json;
            };
            "populate_geometry_columns": {
                Args: {
                    "tbl_oid": unknown;
                    "use_typmod"?: boolean;
                };
                Returns: number;
            } | {
                Args: {
                    "use_typmod"?: boolean;
                };
                Returns: string;
            };
            "postgis_constraint_dims": {
                Args: {
                    "geomcolumn": string;
                    "geomschema": string;
                    "geomtable": string;
                };
                Returns: number;
            };
            "postgis_constraint_srid": {
                Args: {
                    "geomcolumn": string;
                    "geomschema": string;
                    "geomtable": string;
                };
                Returns: number;
            };
            "postgis_constraint_type": {
                Args: {
                    "geomcolumn": string;
                    "geomschema": string;
                    "geomtable": string;
                };
                Returns: string;
            };
            "postgis_extensions_upgrade": {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            "postgis_full_version": {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            "postgis_geos_version": {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            "postgis_lib_build_date": {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            "postgis_lib_revision": {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            "postgis_lib_version": {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            "postgis_libjson_version": {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            "postgis_liblwgeom_version": {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            "postgis_libprotobuf_version": {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            "postgis_libxml_version": {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            "postgis_proj_version": {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            "postgis_scripts_build_date": {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            "postgis_scripts_installed": {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            "postgis_scripts_released": {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            "postgis_svn_version": {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            "postgis_type_name": {
                Args: {
                    "coord_dimension": number;
                    "geomname": string;
                    "use_new_name"?: boolean;
                };
                Returns: string;
            };
            "postgis_version": {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            "postgis_wagyu_version": {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
            "prepare_booking_notification_deliveries": {
                Args: {
                    "p_deliveries": Json;
                    "p_event_id": string;
                    "p_lease_token": string;
                };
                Returns: undefined;
            };
            "prepare_user_lifecycle": {
                Args: {
                    "p_action": string;
                    "p_actor_id": string;
                    "p_reason"?: string;
                    "p_user_id": string;
                };
                Returns: Json;
            };
            "process_whatsapp_inbox": {
                Args: {
                    "p_id": string;
                    "p_receiver": string;
                    "p_token": string;
                };
                Returns: Json;
            };
            "prune_booking_notifications": {
                Args: {
                    "p_limit"?: number;
                };
                Returns: number;
            };
            "prune_whatsapp_inbox": {
                Args: {
                    "p_limit"?: number;
                };
                Returns: number;
            };
            "publish_staff_schedule": {
                Args: {
                    "p_actor": string;
                    "p_biz": string;
                    "p_branch": string;
                    "p_days": Json;
                    "p_expected_revision": number;
                    "p_from": string;
                    "p_kind": string;
                    "p_staff": string;
                };
                Returns: Json;
            };
            "purge_expired_holds": {
                Args: Record<PropertyKey, never>;
                Returns: undefined;
            };
            "read_analytics_report_snapshot": {
                Args: {
                    "p_biz_id"?: string;
                    "p_branch_id"?: string;
                    "p_date_from": string;
                    "p_date_to": string;
                    "p_kind"?: string;
                };
                Returns: Json;
            };
            "read_booking_notification_deliveries": {
                Args: {
                    "p_event_id": string;
                    "p_lease_token": string;
                };
                Returns: Json;
            };
            "read_business_finance_calendar": {
                Args: {
                    "p_biz_id": string;
                };
                Returns: Json;
            };
            "read_cron_execution_health": {
                Args: Record<PropertyKey, never>;
                Returns: Json;
            };
            "read_finance_report_snapshot": {
                Args: {
                    "p_biz_id": string;
                    "p_branch_id"?: string;
                    "p_date_from": string;
                    "p_date_to": string;
                    "p_staff_id"?: string;
                };
                Returns: Json;
            };
            "read_platform_admin_states": {
                Args: {
                    "p_actor_id": string;
                    "p_target_ids": (string)[];
                };
                Returns: Json;
            };
            "read_promotion_analytics_snapshot": {
                Args: {
                    "p_biz_id": string;
                    "p_branch_id"?: string;
                    "p_date_from": string;
                    "p_date_to": string;
                    "p_default_tz"?: string;
                };
                Returns: Json;
            };
            "read_staff_finance_calendar": {
                Args: {
                    "p_biz_id": string;
                    "p_date"?: string;
                    "p_instant"?: string;
                    "p_staff_id": string;
                };
                Returns: Json;
            };
            "read_staff_finance_history": {
                Args: {
                    "p_biz_id": string;
                    "p_date_from"?: string;
                    "p_date_to"?: string;
                    "p_staff_id": string;
                };
                Returns: Json;
            };
            "read_staff_schedule": {
                Args: {
                    "p_biz": string;
                    "p_from": string;
                    "p_staff": string;
                    "p_to": string;
                };
                Returns: Json;
            };
            "read_staff_schedule_draft": {
                Args: {
                    "p_biz": string;
                    "p_day": string;
                    "p_kind": string;
                    "p_staff": string;
                };
                Returns: Json;
            };
            "read_staff_shift_adjustment_snapshot": {
                Args: {
                    "p_actor_id": string;
                    "p_biz_id": string;
                    "p_shift_id": string;
                };
                Returns: Json;
            };
            "read_staff_shift_close_snapshot": {
                Args: {
                    "p_biz_id": string;
                    "p_shift_id": string;
                    "p_staff_id": string;
                };
                Returns: Json;
            };
            "read_staff_shift_snapshot": {
                Args: {
                    "p_biz_id": string;
                    "p_shift_date": string;
                    "p_staff_id": string;
                };
                Returns: Json;
            };
            "read_staff_work_locations": {
                Args: {
                    "p_biz": string;
                    "p_from": string;
                    "p_to": string;
                };
                Returns: {
                    "branch_id": string;
                    "date_on": string;
                    "staff_id": string;
                }[];
            };
            "read_user_lifecycle": {
                Args: {
                    "p_actor_id": string;
                    "p_command_id": string;
                    "p_user_id": string;
                };
                Returns: boolean;
            };
            "recalculate_business_daily_stats": {
                Args: {
                    "p_date": string;
                    "p_default_tz"?: string;
                };
                Returns: Json;
            };
            "recalculate_business_hourly_load": {
                Args: {
                    "p_date": string;
                    "p_default_tz"?: string;
                };
                Returns: Json;
            };
            "recalculate_ratings_for_date": {
                Args: {
                    "p_date"?: string;
                };
                Returns: undefined;
            };
            "recalculate_ratings_for_date_range": {
                Args: {
                    "p_end_date": string;
                    "p_start_date": string;
                };
                Returns: undefined;
            };
            "receive_whatsapp_inbox": {
                Args: {
                    "p_messages": Json;
                    "p_receiver": string;
                };
                Returns: number;
            };
            "record_booking_notification_delivery": {
                Args: {
                    "p_delivery_key": string;
                    "p_event_id": string;
                    "p_lease_token": string;
                    "p_provider_id"?: string;
                };
                Returns: undefined;
            };
            "record_whatsapp_inbox_reply": {
                Args: {
                    "p_id": string;
                    "p_provider_id": string;
                    "p_token": string;
                };
                Returns: undefined;
            };
            "register_whatsapp_mobile_otp_failure": {
                Args: {
                    "p_attempt_id": string;
                };
                Returns: number;
            };
            "reject_application_with_policy": {
                Args: {
                    "p_application_id": string;
                    "p_application_kind": string;
                    "p_block_days"?: number;
                    "p_reason"?: string;
                    "p_reviewer_user_id": string;
                };
                Returns: boolean;
            };
            "release_application_submission_block": {
                Args: {
                    "p_application_id": string;
                    "p_block_id": string;
                    "p_reviewer_user_id": string;
                };
                Returns: boolean;
            };
            "release_auth_phone": {
                Args: {
                    "p_phone_digits": string;
                    "p_user_id": string;
                };
                Returns: number;
            };
            "release_staff_shift_claims": {
                Args: {
                    "p_claim_token": string;
                    "p_shift_ids": (string)[];
                };
                Returns: undefined;
            };
            "release_unconfirmed_phone": {
                Args: {
                    "p_phone_digits": string;
                };
                Returns: number;
            };
            "release_whatsapp_inbox": {
                Args: {
                    "p_id": string;
                    "p_token": string;
                };
                Returns: undefined;
            };
            "remove_user_notification_email_source": {
                Args: {
                    "target_source": string;
                    "target_user_id": string;
                };
                Returns: undefined;
            };
            "replace_branch_schedule": {
                Args: {
                    "p_actor": string;
                    "p_biz": string;
                    "p_branch": string;
                    "p_days": Json;
                };
                Returns: undefined;
            };
            "reset_staff_schedule_day": {
                Args: {
                    "p_actor": string;
                    "p_biz": string;
                    "p_day": string;
                    "p_expected_revision": number;
                    "p_staff": string;
                };
                Returns: Json;
            };
            "resolve_staff_day": {
                Args: {
                    "p_date": string;
                    "p_staff_id": string;
                };
                Returns: {
                    "branch_id": string;
                    "breaks": Json;
                    "intervals": Json;
                    "tz": string;
                }[];
            };
            "resolve_staff_day_legacy": {
                Args: {
                    "p_date": string;
                    "p_staff_id": string;
                };
                Returns: {
                    "branch_id": string;
                    "breaks": Json;
                    "intervals": Json;
                    "tz": string;
                }[];
            };
            "revoke_branch_admin": {
                Args: {
                    "p_branch_id": string;
                    "p_user_id": string;
                };
                Returns: undefined;
            };
            "role_id": {
                Args: {
                    "p_key": string;
                };
                Returns: string;
            };
            "save_shift_items_atomic": {
                Args: {
                    "p_items": Json;
                    "p_shift_id": string;
                };
                Returns: Json;
            };
            "save_staff_shift_command": {
                Args: {
                    "p_actor_id"?: string;
                    "p_allow_create"?: boolean;
                    "p_biz_id": string;
                    "p_expected_revision"?: number;
                    "p_expected_shift_id"?: string;
                    "p_items": Json;
                    "p_shift_date": string;
                    "p_staff_id": string;
                };
                Returns: Json;
            };
            "save_staff_shift_command_internal_v1": {
                Args: {
                    "p_actor_id"?: string;
                    "p_allow_create"?: boolean;
                    "p_biz_id": string;
                    "p_expected_revision"?: number;
                    "p_items": Json;
                    "p_shift_date": string;
                    "p_staff_id": string;
                };
                Returns: Json;
            };
            "schedule_actor_can_manage": {
                Args: {
                    "p_actor": string;
                    "p_biz": string;
                };
                Returns: boolean;
            };
            "schedule_bound_to_branch": {
                Args: {
                    "p_biz": string;
                    "p_date": string;
                    "p_day": Json;
                };
                Returns: Json;
            };
            "schedule_contains_booking": {
                Args: {
                    "p_branch": string;
                    "p_end": string;
                    "p_staff": string;
                    "p_start": string;
                };
                Returns: boolean;
            };
            "schedule_effective_day": {
                Args: {
                    "p_day": string;
                    "p_staff": string;
                };
                Returns: Json;
            };
            "schedule_validate_day": {
                Args: {
                    "p_day": Json;
                };
                Returns: undefined;
            };
            "set_my_notification_email_preferences": {
                Args: {
                    "target_emails": (string)[];
                    "target_enabled": boolean;
                };
                Returns: undefined;
            };
            "set_platform_admin_role": {
                Args: {
                    "p_actor_id": string;
                    "p_enabled": boolean;
                    "p_target_user_id": string;
                };
                Returns: boolean;
            };
            "show_limit": {
                Args: Record<PropertyKey, never>;
                Returns: number;
            };
            "show_trgm": {
                Args: {
                    "": string;
                };
                Returns: (string)[];
            };
            "st_3dclosestpoint": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: unknown;
            };
            "st_3ddistance": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: number;
            };
            "st_3dintersects": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "st_3dlongestline": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: unknown;
            };
            "st_3dmakebox": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: unknown;
            };
            "st_3dmaxdistance": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: number;
            };
            "st_3dshortestline": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: unknown;
            };
            "st_addpoint": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: unknown;
            };
            "st_angle": {
                Args: {
                    "line1": unknown;
                    "line2": unknown;
                };
                Returns: number;
            } | {
                Args: {
                    "pt1": unknown;
                    "pt2": unknown;
                    "pt3": unknown;
                    "pt4"?: unknown;
                };
                Returns: number;
            };
            "st_area": {
                Args: {
                    "geog": unknown;
                    "use_spheroid"?: boolean;
                };
                Returns: number;
            } | {
                Args: {
                    "": string;
                };
                Returns: number;
            };
            "st_asencodedpolyline": {
                Args: {
                    "geom": unknown;
                    "nprecision"?: number;
                };
                Returns: string;
            };
            "st_asewkt": {
                Args: {
                    "": string;
                };
                Returns: string;
            };
            "st_asgeojson": {
                Args: {
                    "geog": unknown;
                    "maxdecimaldigits"?: number;
                    "options"?: number;
                };
                Returns: string;
            } | {
                Args: {
                    "geom": unknown;
                    "maxdecimaldigits"?: number;
                    "options"?: number;
                };
                Returns: string;
            } | {
                Args: {
                    "geom_column"?: string;
                    "maxdecimaldigits"?: number;
                    "pretty_bool"?: boolean;
                    "r": Record<string, unknown>;
                };
                Returns: string;
            } | {
                Args: {
                    "": string;
                };
                Returns: string;
            };
            "st_asgml": {
                Args: {
                    "geog": unknown;
                    "id"?: string;
                    "maxdecimaldigits"?: number;
                    "nprefix"?: string;
                    "options"?: number;
                };
                Returns: string;
            } | {
                Args: {
                    "geom": unknown;
                    "maxdecimaldigits"?: number;
                    "options"?: number;
                };
                Returns: string;
            } | {
                Args: {
                    "": string;
                };
                Returns: string;
            } | {
                Args: {
                    "geog": unknown;
                    "id"?: string;
                    "maxdecimaldigits"?: number;
                    "nprefix"?: string;
                    "options"?: number;
                    "version": number;
                };
                Returns: string;
            } | {
                Args: {
                    "geom": unknown;
                    "id"?: string;
                    "maxdecimaldigits"?: number;
                    "nprefix"?: string;
                    "options"?: number;
                    "version": number;
                };
                Returns: string;
            };
            "st_askml": {
                Args: {
                    "geog": unknown;
                    "maxdecimaldigits"?: number;
                    "nprefix"?: string;
                };
                Returns: string;
            } | {
                Args: {
                    "geom": unknown;
                    "maxdecimaldigits"?: number;
                    "nprefix"?: string;
                };
                Returns: string;
            } | {
                Args: {
                    "": string;
                };
                Returns: string;
            };
            "st_aslatlontext": {
                Args: {
                    "geom": unknown;
                    "tmpl"?: string;
                };
                Returns: string;
            };
            "st_asmarc21": {
                Args: {
                    "format"?: string;
                    "geom": unknown;
                };
                Returns: string;
            };
            "st_asmvtgeom": {
                Args: {
                    "bounds": unknown;
                    "buffer"?: number;
                    "clip_geom"?: boolean;
                    "extent"?: number;
                    "geom": unknown;
                };
                Returns: unknown;
            };
            "st_assvg": {
                Args: {
                    "geog": unknown;
                    "maxdecimaldigits"?: number;
                    "rel"?: number;
                };
                Returns: string;
            } | {
                Args: {
                    "geom": unknown;
                    "maxdecimaldigits"?: number;
                    "rel"?: number;
                };
                Returns: string;
            } | {
                Args: {
                    "": string;
                };
                Returns: string;
            };
            "st_astext": {
                Args: {
                    "": string;
                };
                Returns: string;
            };
            "st_astwkb": {
                Args: {
                    "geom": unknown;
                    "prec"?: number;
                    "prec_m"?: number;
                    "prec_z"?: number;
                    "with_boxes"?: boolean;
                    "with_sizes"?: boolean;
                };
                Returns: string;
            } | {
                Args: {
                    "geom": (unknown)[];
                    "ids": (number)[];
                    "prec"?: number;
                    "prec_m"?: number;
                    "prec_z"?: number;
                    "with_boxes"?: boolean;
                    "with_sizes"?: boolean;
                };
                Returns: string;
            };
            "st_asx3d": {
                Args: {
                    "geom": unknown;
                    "maxdecimaldigits"?: number;
                    "options"?: number;
                };
                Returns: string;
            };
            "st_azimuth": {
                Args: {
                    "geog1": unknown;
                    "geog2": unknown;
                };
                Returns: number;
            } | {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: number;
            };
            "st_boundingdiagonal": {
                Args: {
                    "fits"?: boolean;
                    "geom": unknown;
                };
                Returns: unknown;
            };
            "st_buffer": {
                Args: {
                    "geom": unknown;
                    "options"?: string;
                    "radius": number;
                };
                Returns: unknown;
            } | {
                Args: {
                    "geom": unknown;
                    "quadsegs": number;
                    "radius": number;
                };
                Returns: unknown;
            };
            "st_centroid": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_clipbybox2d": {
                Args: {
                    "box": unknown;
                    "geom": unknown;
                };
                Returns: unknown;
            };
            "st_closestpoint": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: unknown;
            };
            "st_collect": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: unknown;
            };
            "st_concavehull": {
                Args: {
                    "param_allow_holes"?: boolean;
                    "param_geom": unknown;
                    "param_pctconvex": number;
                };
                Returns: unknown;
            };
            "st_contains": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "st_containsproperly": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "st_coorddim": {
                Args: {
                    "geometry": unknown;
                };
                Returns: number;
            };
            "st_coveredby": {
                Args: {
                    "geog1": unknown;
                    "geog2": unknown;
                };
                Returns: boolean;
            } | {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "st_covers": {
                Args: {
                    "geog1": unknown;
                    "geog2": unknown;
                };
                Returns: boolean;
            } | {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "st_crosses": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "st_curvetoline": {
                Args: {
                    "flags"?: number;
                    "geom": unknown;
                    "tol"?: number;
                    "toltype"?: number;
                };
                Returns: unknown;
            };
            "st_delaunaytriangles": {
                Args: {
                    "flags"?: number;
                    "g1": unknown;
                    "tolerance"?: number;
                };
                Returns: unknown;
            };
            "st_difference": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                    "gridsize"?: number;
                };
                Returns: unknown;
            };
            "st_disjoint": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "st_distance": {
                Args: {
                    "geog1": unknown;
                    "geog2": unknown;
                    "use_spheroid"?: boolean;
                };
                Returns: number;
            } | {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: number;
            };
            "st_distancesphere": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: number;
            } | {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                    "radius": number;
                };
                Returns: number;
            };
            "st_distancespheroid": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: number;
            };
            "st_dwithin": {
                Args: {
                    "geog1": unknown;
                    "geog2": unknown;
                    "tolerance": number;
                    "use_spheroid"?: boolean;
                };
                Returns: boolean;
            };
            "st_equals": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "st_expand": {
                Args: {
                    "box": unknown;
                    "dx": number;
                    "dy": number;
                };
                Returns: unknown;
            } | {
                Args: {
                    "box": unknown;
                    "dx": number;
                    "dy": number;
                    "dz"?: number;
                };
                Returns: unknown;
            } | {
                Args: {
                    "dm"?: number;
                    "dx": number;
                    "dy": number;
                    "dz"?: number;
                    "geom": unknown;
                };
                Returns: unknown;
            };
            "st_force3d": {
                Args: {
                    "geom": unknown;
                    "zvalue"?: number;
                };
                Returns: unknown;
            };
            "st_force3dm": {
                Args: {
                    "geom": unknown;
                    "mvalue"?: number;
                };
                Returns: unknown;
            };
            "st_force3dz": {
                Args: {
                    "geom": unknown;
                    "zvalue"?: number;
                };
                Returns: unknown;
            };
            "st_force4d": {
                Args: {
                    "geom": unknown;
                    "mvalue"?: number;
                    "zvalue"?: number;
                };
                Returns: unknown;
            };
            "st_generatepoints": {
                Args: {
                    "area": unknown;
                    "npoints": number;
                };
                Returns: unknown;
            } | {
                Args: {
                    "area": unknown;
                    "npoints": number;
                    "seed": number;
                };
                Returns: unknown;
            };
            "st_geogfromtext": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_geographyfromtext": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_geohash": {
                Args: {
                    "geog": unknown;
                    "maxchars"?: number;
                };
                Returns: string;
            } | {
                Args: {
                    "geom": unknown;
                    "maxchars"?: number;
                };
                Returns: string;
            };
            "st_geomcollfromtext": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_geometricmedian": {
                Args: {
                    "fail_if_not_converged"?: boolean;
                    "g": unknown;
                    "max_iter"?: number;
                    "tolerance"?: number;
                };
                Returns: unknown;
            };
            "st_geometryfromtext": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_geomfromewkt": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_geomfromgeojson": {
                Args: {
                    "": Json;
                };
                Returns: unknown;
            } | {
                Args: {
                    "": Json;
                };
                Returns: unknown;
            } | {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_geomfromgml": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_geomfromkml": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_geomfrommarc21": {
                Args: {
                    "marc21xml": string;
                };
                Returns: unknown;
            };
            "st_geomfromtext": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_gmltosql": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_hasarc": {
                Args: {
                    "geometry": unknown;
                };
                Returns: boolean;
            };
            "st_hausdorffdistance": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: number;
            };
            "st_hexagon": {
                Args: {
                    "cell_i": number;
                    "cell_j": number;
                    "origin"?: unknown;
                    "size": number;
                };
                Returns: unknown;
            };
            "st_hexagongrid": {
                Args: {
                    "bounds": unknown;
                    "size": number;
                };
                Returns: Record<string, unknown>[];
            };
            "st_interpolatepoint": {
                Args: {
                    "line": unknown;
                    "point": unknown;
                };
                Returns: number;
            };
            "st_intersection": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                    "gridsize"?: number;
                };
                Returns: unknown;
            };
            "st_intersects": {
                Args: {
                    "geog1": unknown;
                    "geog2": unknown;
                };
                Returns: boolean;
            } | {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "st_isvaliddetail": {
                Args: {
                    "flags"?: number;
                    "geom": unknown;
                };
                Returns: Database["public"]['CompositeTypes']["valid_detail"];
                SetofOptions: {
                    from: "*";
                    to: "valid_detail";
                    isOneToOne: true;
                    isSetofReturn: false;
                };
            };
            "st_length": {
                Args: {
                    "geog": unknown;
                    "use_spheroid"?: boolean;
                };
                Returns: number;
            } | {
                Args: {
                    "": string;
                };
                Returns: number;
            };
            "st_letters": {
                Args: {
                    "font"?: Json;
                    "letters": string;
                };
                Returns: unknown;
            };
            "st_linecrossingdirection": {
                Args: {
                    "line1": unknown;
                    "line2": unknown;
                };
                Returns: number;
            };
            "st_linefromencodedpolyline": {
                Args: {
                    "nprecision"?: number;
                    "txtin": string;
                };
                Returns: unknown;
            };
            "st_linefromtext": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_linelocatepoint": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: number;
            };
            "st_linetocurve": {
                Args: {
                    "geometry": unknown;
                };
                Returns: unknown;
            };
            "st_locatealong": {
                Args: {
                    "geometry": unknown;
                    "leftrightoffset"?: number;
                    "measure": number;
                };
                Returns: unknown;
            };
            "st_locatebetween": {
                Args: {
                    "frommeasure": number;
                    "geometry": unknown;
                    "leftrightoffset"?: number;
                    "tomeasure": number;
                };
                Returns: unknown;
            };
            "st_locatebetweenelevations": {
                Args: {
                    "fromelevation": number;
                    "geometry": unknown;
                    "toelevation": number;
                };
                Returns: unknown;
            };
            "st_longestline": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: unknown;
            };
            "st_makebox2d": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: unknown;
            };
            "st_makeline": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: unknown;
            };
            "st_makevalid": {
                Args: {
                    "geom": unknown;
                    "params": string;
                };
                Returns: unknown;
            };
            "st_maxdistance": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: number;
            };
            "st_minimumboundingcircle": {
                Args: {
                    "inputgeom": unknown;
                    "segs_per_quarter"?: number;
                };
                Returns: unknown;
            };
            "st_mlinefromtext": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_mpointfromtext": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_mpolyfromtext": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_multilinestringfromtext": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_multipointfromtext": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_multipolygonfromtext": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_node": {
                Args: {
                    "g": unknown;
                };
                Returns: unknown;
            };
            "st_normalize": {
                Args: {
                    "geom": unknown;
                };
                Returns: unknown;
            };
            "st_offsetcurve": {
                Args: {
                    "distance": number;
                    "line": unknown;
                    "params"?: string;
                };
                Returns: unknown;
            };
            "st_orderingequals": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "st_overlaps": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "st_perimeter": {
                Args: {
                    "geog": unknown;
                    "use_spheroid"?: boolean;
                };
                Returns: number;
            };
            "st_pointfromtext": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_pointm": {
                Args: {
                    "mcoordinate": number;
                    "srid"?: number;
                    "xcoordinate": number;
                    "ycoordinate": number;
                };
                Returns: unknown;
            };
            "st_pointz": {
                Args: {
                    "srid"?: number;
                    "xcoordinate": number;
                    "ycoordinate": number;
                    "zcoordinate": number;
                };
                Returns: unknown;
            };
            "st_pointzm": {
                Args: {
                    "mcoordinate": number;
                    "srid"?: number;
                    "xcoordinate": number;
                    "ycoordinate": number;
                    "zcoordinate": number;
                };
                Returns: unknown;
            };
            "st_polyfromtext": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_polygonfromtext": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_project": {
                Args: {
                    "azimuth": number;
                    "distance": number;
                    "geog": unknown;
                };
                Returns: unknown;
            };
            "st_quantizecoordinates": {
                Args: {
                    "g": unknown;
                    "prec_m"?: number;
                    "prec_x": number;
                    "prec_y"?: number;
                    "prec_z"?: number;
                };
                Returns: unknown;
            };
            "st_reduceprecision": {
                Args: {
                    "geom": unknown;
                    "gridsize": number;
                };
                Returns: unknown;
            };
            "st_relate": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: string;
            };
            "st_removerepeatedpoints": {
                Args: {
                    "geom": unknown;
                    "tolerance"?: number;
                };
                Returns: unknown;
            };
            "st_segmentize": {
                Args: {
                    "geog": unknown;
                    "max_segment_length": number;
                };
                Returns: unknown;
            };
            "st_setsrid": {
                Args: {
                    "geog": unknown;
                    "srid": number;
                };
                Returns: unknown;
            } | {
                Args: {
                    "geom": unknown;
                    "srid": number;
                };
                Returns: unknown;
            };
            "st_sharedpaths": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: unknown;
            };
            "st_shortestline": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: unknown;
            };
            "st_simplifypolygonhull": {
                Args: {
                    "geom": unknown;
                    "is_outer"?: boolean;
                    "vertex_fraction": number;
                };
                Returns: unknown;
            };
            "st_split": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: unknown;
            };
            "st_square": {
                Args: {
                    "cell_i": number;
                    "cell_j": number;
                    "origin"?: unknown;
                    "size": number;
                };
                Returns: unknown;
            };
            "st_squaregrid": {
                Args: {
                    "bounds": unknown;
                    "size": number;
                };
                Returns: Record<string, unknown>[];
            };
            "st_srid": {
                Args: {
                    "geog": unknown;
                };
                Returns: number;
            } | {
                Args: {
                    "geom": unknown;
                };
                Returns: number;
            };
            "st_subdivide": {
                Args: {
                    "geom": unknown;
                    "gridsize"?: number;
                    "maxvertices"?: number;
                };
                Returns: unknown[];
            };
            "st_swapordinates": {
                Args: {
                    "geom": unknown;
                    "ords": unknown;
                };
                Returns: unknown;
            };
            "st_symdifference": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                    "gridsize"?: number;
                };
                Returns: unknown;
            };
            "st_symmetricdifference": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: unknown;
            };
            "st_tileenvelope": {
                Args: {
                    "bounds"?: unknown;
                    "margin"?: number;
                    "x": number;
                    "y": number;
                    "zoom": number;
                };
                Returns: unknown;
            };
            "st_touches": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "st_transform": {
                Args: {
                    "from_proj": string;
                    "geom": unknown;
                    "to_proj": string;
                };
                Returns: unknown;
            } | {
                Args: {
                    "from_proj": string;
                    "geom": unknown;
                    "to_srid": number;
                };
                Returns: unknown;
            } | {
                Args: {
                    "geom": unknown;
                    "to_proj": string;
                };
                Returns: unknown;
            };
            "st_triangulatepolygon": {
                Args: {
                    "g1": unknown;
                };
                Returns: unknown;
            };
            "st_union": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: unknown;
            } | {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                    "gridsize": number;
                };
                Returns: unknown;
            };
            "st_voronoilines": {
                Args: {
                    "extend_to"?: unknown;
                    "g1": unknown;
                    "tolerance"?: number;
                };
                Returns: unknown;
            };
            "st_voronoipolygons": {
                Args: {
                    "extend_to"?: unknown;
                    "g1": unknown;
                    "tolerance"?: number;
                };
                Returns: unknown;
            };
            "st_within": {
                Args: {
                    "geom1": unknown;
                    "geom2": unknown;
                };
                Returns: boolean;
            };
            "st_wkbtosql": {
                Args: {
                    "wkb": string;
                };
                Returns: unknown;
            };
            "st_wkttosql": {
                Args: {
                    "": string;
                };
                Returns: unknown;
            };
            "st_wrapx": {
                Args: {
                    "geom": unknown;
                    "move": number;
                    "wrap": number;
                };
                Returns: unknown;
            };
            "staff_private_fields": {
                Args: {
                    "p_staff_id": string;
                };
                Returns: {
                    "avatar_url": string;
                    "biz_id": string;
                    "branch_id": string;
                    "email": string;
                    "full_name": string;
                    "hourly_rate": number;
                    "id": string;
                    "is_active": boolean;
                    "percent_master": number;
                    "percent_salon": number;
                    "phone": string;
                    "rating_score": number;
                    "user_id": string;
                }[];
            };
            "staff_write_allowed": {
                Args: {
                    "p_biz_id": string;
                    "p_branch_id": string;
                };
                Returns: boolean;
            };
            "start_cron_execution": {
                Args: {
                    "p_id": string;
                    "p_job": string;
                };
                Returns: string;
            };
            "super_admin_user_ids": {
                Args: Record<PropertyKey, never>;
                Returns: (string)[];
            };
            "sync_user_notification_email": {
                Args: {
                    "target_email": string;
                    "target_provider_subject"?: string;
                    "target_source": string;
                    "target_user_id": string;
                };
                Returns: undefined;
            };
            "transfer_staff_home": {
                Args: {
                    "p_actor": string;
                    "p_biz": string;
                    "p_expected_branch": string;
                    "p_staff": string;
                    "p_target": string;
                };
                Returns: Json;
            };
            "transition_telegram_profile_link": {
                Args: {
                    "p_action": string;
                    "p_hash": string;
                    "p_name"?: string;
                    "p_owner"?: string;
                    "p_telegram"?: number;
                    "p_username"?: string;
                };
                Returns: Json;
            };
            "transition_telegram_web_login": {
                Args: {
                    "p_action": string;
                    "p_browser"?: string;
                    "p_hash": string;
                    "p_name"?: string;
                    "p_telegram"?: number;
                };
                Returns: Json;
            };
            "unlink_auth_identity": {
                Args: {
                    "target_provider": string;
                    "target_user_id": string;
                };
                Returns: number;
            };
            "unlockrows": {
                Args: {
                    "": string;
                };
                Returns: number;
            };
            "update_all_aggregated_ratings": {
                Args: Record<PropertyKey, never>;
                Returns: undefined;
            };
            "update_booking_status_no_check": {
                Args: {
                    "p_booking_id": string;
                    "p_new_status": Database["public"]['Enums']["booking_status"];
                };
                Returns: undefined;
            };
            "update_booking_status_with_promotion": {
                Args: {
                    "p_booking_id": string;
                    "p_new_status": Database["public"]['Enums']["booking_status"];
                };
                Returns: Json;
            };
            "update_service_group": {
                Args: {
                    "p_active": boolean;
                    "p_biz_id": string;
                    "p_branch_ids": (string)[];
                    "p_duration_min": number;
                    "p_name_en": string;
                    "p_name_ky": string;
                    "p_name_ru": string;
                    "p_price_from": number;
                    "p_price_to": number;
                    "p_service_id": string;
                };
                Returns: Json;
            };
            "update_shift_aggregates": {
                Args: {
                    "p_biz_id": string;
                    "p_guaranteed_amount"?: number;
                    "p_late_minutes": number;
                    "p_master_share": number;
                    "p_salon_share": number;
                    "p_shift_date": string;
                    "p_staff_id": string;
                    "p_topup_amount"?: number;
                    "p_total_amount": number;
                };
                Returns: undefined;
            };
            "updategeometrysrid": {
                Args: {
                    "catalogn_name": string;
                    "column_name": string;
                    "new_srid_in": number;
                    "schema_name": string;
                    "table_name": string;
                };
                Returns: string;
            };
            "user_lifecycle_access_allowed": {
                Args: Record<PropertyKey, never>;
                Returns: boolean;
            };
            "whatsapp_inbox_backlog_health": {
                Args: Record<PropertyKey, never>;
                Returns: Json;
            };
        };
        Enums: {
            "booking_status": "hold" | "confirmed" | "paid" | "cancelled" | "no_show";
            "promotion_type": "free_after_n_visits" | "referral_free" | "referral_discount_50" | "birthday_discount" | "first_visit_discount";
            "schedule_rule_kind": "weekly" | "date" | "range";
            "visit_package_discount_type": "percent" | "fixed_price";
        };
        CompositeTypes: {
            "geometry_dump": {
                "path": (number)[] | null;
                "geom": unknown;
            };
            "valid_detail": {
                "valid": boolean | null;
                "reason": string | null;
                "location": unknown;
            };
        };
    };
};
type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];
export type Tables<DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"]) : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
    Row: infer R;
} ? R : never : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
    Row: infer R;
} ? R : never : never;
export type TablesInsert<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I;
} ? I : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I;
} ? I : never : never;
export type TablesUpdate<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U;
} ? U : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U;
} ? U : never : never;
export type Enums<DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | {
    schema: keyof DatabaseWithoutInternals;
}, EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"] : never = never> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName] : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions] : never;
export type CompositeTypes<PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] | {
    schema: keyof DatabaseWithoutInternals;
}, CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"] : never = never> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName] : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions] : never;
export const Constants = {
    "public": {
        Enums: {
            "booking_status": ["hold", "confirmed", "paid", "cancelled", "no_show"], "promotion_type": ["free_after_n_visits", "referral_free", "referral_discount_50", "birthday_discount", "first_visit_discount"], "schedule_rule_kind": ["weekly", "date", "range"], "visit_package_discount_type": ["percent", "fixed_price"]
        }
    }
} as const;
