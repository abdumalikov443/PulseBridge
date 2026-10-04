import { registerEnumType } from '@nestjs/graphql';

export enum MemberType {
    PATIENT = 'PATIENT',
    DOCTOR = 'DOCTOR',
    CLINIC = 'CLINIC',
    ADMIN = 'ADMIN',
}
registerEnumType(MemberType, { name: 'MemberType' });

export enum MemberStatus {
    ACTIVE = 'ACTIVE',
    BLOCK = 'BLOCK',
    DELETE = 'DELETE',
}
registerEnumType(MemberStatus, { name: 'MemberStatus' });
