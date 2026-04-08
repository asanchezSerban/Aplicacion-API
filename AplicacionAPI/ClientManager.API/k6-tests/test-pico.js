import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50  }, // carga normal
    { duration: '2m', target: 150 }, // sube al pico
    { duration: '1m', target: 50  }, // vuelve a normal
    { duration: '1m', target: 0   }, // baja a 0
  ]
};

export default function () {
  const res = http.get('http://localhost:5000/api/clients');

  check(res, {
    'status es 200': (r) => r.status === 200,
    'respuesta en menos de 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}