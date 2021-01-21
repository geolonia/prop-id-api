declare namespace IncrementP {
    export type Feature = {
        type: 'Feature',
    }

    export type VerifiedAddress = {
        type: 'FeatureCollection',
        query: [string],
        features: Feature[],
        attribution: string
    }
    export type APIError = {
        error: true,
        status: number
    }
}

declare namespace NodeJS {
    interface ProcessEnv {
        readonly INCREMENTP_VERIFICATION_API_ENDPOINT: string
        readonly INCREMENTP_VERIFICATION_API_KEY: string
    }
}