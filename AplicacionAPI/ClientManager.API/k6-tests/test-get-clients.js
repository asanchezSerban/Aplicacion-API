import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
    vus: 200,        // x usuarios virtuales simultáneos
    duration: '30s' // durante x segundos
};

export default function () {
    const res = http.get('http://localhost:5000/api/clients');

    check(res, {
        'status es 200': (r) => r.status === 200,
        'respuesta en menos de 500ms': (r) => r.timings.duration < 500,
    });

    sleep(1);
}