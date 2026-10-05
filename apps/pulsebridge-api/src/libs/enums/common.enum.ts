import { registerEnumType } from "@nestjs/graphql";

export enum Message {
    SOMETHING_WENT_WRONG = "Something went wrong!",
    NO_DATA_FOUND = "No data is found!",
    CREATE_FAILED = "Create is failed!",
    UPDATE_FAILED = "Update is failed!",
    REMOVE_FAILED = "Remove is failed!",
    UPLOAD_FAILED = "Upload is failed!",
    BAD_REQUEST = "Bad request",

    USED_MEMBER_NICK_OR_PHONE = "Already used member nick or phone!",
    NO_MEMBER_NICK = "No member with that membernick!",
    BLOCKED_USER = "You have been blocked!",
    WRONG_PASSWORD = "Wrong password, try again please!",
    NOT_AUTHENTICATED = "You are not authenticated, please login first!",
    TOKEN_NOT_EXIST = "Bearer Token is not provided",
    ONLY_SPECIFIC_ROLES_ALLOWED = "Allowed only for members with specific roles",
    NOT_ALLOWED_REQUEST = "Not Allowed Request",
    PROVIDE_ALLOWED_FORMAT = "Please provide , jpg, jpeg or png images",
    SELF_SUBSCRIPTION_DENIED = "Self subscription is denied!",

    NO_CLINIC = "No clinic is linked to this account!",
    DOCTOR_REQUEST_EXISTS = "You already have a pending join request!",
    DOCTOR_HAS_CLINIC = "You already work in a clinic!",
    NO_DOCTOR_PROFILE = "Doctor profile is not found!",
    PROFILE_MISMATCH = "Send only the profile that matches memberType (doctorProfile for DOCTOR, clinicProfile for CLINIC)!",
    FIRST_ACCOUNT_ADMIN = "The first account becomes the platform ADMIN, sign it up without a profile!",
    CLINIC_HAS_APPOINTMENTS = "Clinic has confirmed appointments, cancel them first!",
    DOCTOR_HAS_APPOINTMENTS = "Doctor has confirmed appointments, cancel them first!",
    SLOT_TAKEN = "This time slot is already booked!",
    INVALID_APPOINTMENT_DATE = "Invalid appointment date, use YYYY-MM-DD!",
    PAST_APPOINTMENT = "Appointment time must be in the future!",
    SELF_APPOINTMENT_DENIED = "You cannot book an appointment with yourself!",
}

export enum Direction {
    ASC = 1,
    DESC = -1
}

registerEnumType(Direction, {name: 'Direction'});