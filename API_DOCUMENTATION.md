# API Documentation

Документация всех API endpoints проекта Kezek.

## Интерактивная документация (Swagger UI)

Для интерактивной документации с возможностью тестирования endpoints используйте Swagger UI:
- **Локально**: http://localhost:3000/api-docs
- **Production**: https://kezek.kg/api-docs

Swagger UI позволяет:
- Просматривать все доступные endpoints
- Видеть схемы запросов и ответов
- Тестировать endpoints прямо из браузера
- Автоматически генерировать клиентский код

OpenAPI спецификация доступна в формате JSON: `/api/swagger.json`

## Содержание

- [Аутентификация](#аутентификация)
- [Бронирования](#бронирования)
- [Сотрудники](#сотрудники)
- [Смены](#смены)
- [Филиалы](#филиалы)
- [Услуги](#услуги)
- [Отзывы](#отзывы)
- [Дашборд](#дашборд)
- [Администрирование](#администрирование)
- [Cron Jobs](#cron-jobs)
- [Webhooks](#webhooks)
- [Профиль](#профиль)
- [Уведомления](#уведомления)
- [WhatsApp](#whatsapp)

---

## Аутентификация

### POST `/api/auth/telegram/login`

Авторизация через Telegram.

**Параметры запроса:**
```json
{
  "initData": "string" // Telegram WebApp initData
}
```

**Ответ:**
```json
{
  "ok": true,
  "user": {
    "id": "uuid",
    "email": "string",
    "phone": "string"
  },
  "session": {
    "access_token": "string",
    "refresh_token": "string"
  }
}
```

**Ошибки:**
- `400` - Неверные данные
- `401` - Ошибка авторизации

---

### POST `/api/auth/telegram/link`

Привязка Telegram аккаунта к существующему пользователю.

**Параметры запроса:**
```json
{
  "initData": "string" // Telegram WebApp initData
}
```

**Ответ:**
```json
{
  "ok": true,
  "linked": true
}
```

---

### POST `/api/auth/sign-out`

Выход из системы.

**Ответ:**
```json
{
  "ok": true
}
```

---

### POST `/api/auth/mobile-exchange`

Обмен токена для мобильного приложения.

**Параметры запроса:**
```json
{
  "refresh_token": "string"
}
```

**Ответ:**
```json
{
  "access_token": "string",
  "refresh_token": "string"
}
```

---

## Бронирования

### POST `/api/quick-hold`

Быстрое создание бронирования (hold) для авторизованных пользователей.

**Rate Limiting:** `public` (100 req/15min)

**Параметры запроса:**
```json
{
  "biz_id": "uuid",
  "branch_id": "uuid", // опционально, если не указан - берется первый активный филиал
  "service_id": "uuid",
  "staff_id": "uuid",
  "start_at": "2024-01-15T10:00:00+06:00" // ISO строка с таймзоной
}
```

**Авторизация:**
- Bearer token в заголовке `Authorization` (для мобильного приложения)
- Или cookies (для веб-версии)

**Ответ:**
```json
{
  "ok": true,
  "booking_id": "uuid",
  "confirmed": true
}
```

**Ошибки:**
- `400` - Неверные параметры, нет активного филиала, ошибка RPC
- `401` - Не авторизован

---

### POST `/api/quick-book-guest`

Быстрое создание бронирования для гостей (без регистрации).

**Rate Limiting:** `public` (50 req/15min)

**Параметры запроса:**
```json
{
  "biz_id": "uuid",
  "service_id": "uuid",
  "staff_id": "uuid",
  "start_at": "2024-01-15T10:00:00+06:00",
  "client_name": "string",
  "client_phone": "string",
  "client_email": "string" // опционально
}
```

**Ответ:**
```json
{
  "ok": true,
  "booking_id": "uuid"
}
```

**Ошибки:**
- `400` - Неверные параметры
- `429` - Превышен лимит запросов

---

### POST `/api/bookings/[id]/mark-attendance`

Отметка посещения клиента (пришел/не пришел).

**Rate Limiting:** `normal` (60 req/min)

**Параметры запроса:**
```json
{
  "attended": true // true = пришел, false = не пришел
}
```

**Требования:**
- Только менеджеры бизнеса
- Бронирование должно принадлежать бизнесу менеджера

**Ответ:**
```json
{
  "ok": true,
  "booking": {
    "id": "uuid",
    "status": "paid",
    "total_amount": 1000,
    "promotion_applied": {
      "id": "uuid",
      "title_ru": "Скидка 50%"
    }
  }
}
```

**Ошибки:**
- `400` - Неверные параметры, бронирование не найдено
- `403` - Нет доступа
- `404` - Бронирование не найдено

---

### POST `/api/bookings/[id]/cancel`

Отмена бронирования.

**Параметры запроса:**
```json
{
  "reason": "string" // опционально
}
```

**Ответ:**
```json
{
  "ok": true,
  "booking_id": "uuid"
}
```

---

## Сотрудники

### POST `/api/staff/shift/open`

Открытие смены сотрудника.

**Rate Limiting:** `critical` (30 req/min)

**Требования:**
- Только сотрудники
- Не должен быть выходной день
- Не должно быть открытой смены на сегодня

**Параметры запроса:**
```json
{} // Нет параметров, используется контекст сотрудника
```

**Ответ:**
```json
{
  "ok": true,
  "shift_id": "uuid",
  "date": "2024-01-15"
}
```

**Ошибки:**
- `400` - Выходной день, смена уже открыта
- `403` - Нет доступа

---

### GET `/api/staff/finance`

Получение данных смены сотрудника для финансового модуля.

**Rate Limiting:** `normal` (60 req/min)

**Query параметры:**
- `staffId` (опционально) - ID сотрудника (для менеджеров/владельцев)
- `date` (опционально) - дата в формате `YYYY-MM-DD` (по умолчанию сегодня)

**Требования:**
- Для сотрудников: авторизация через `getStaffContext` (получает данные своей смены)
- Для менеджеров: авторизация через `getBizContextForManagers` (может указать `staffId`)

**Ответ:**
```json
{
  "ok": true,
  "data": {
    "shift": {
      "id": "uuid",
      "shift_date": "2024-01-26",
      "status": "open" | "closed",
      "total_amount": 10000,
      "consumables_amount": 500,
      "master_share": 6000,
      "salon_share": 4500,
      "percent_master": 60,
      "percent_salon": 40,
      "hours_worked": 8.5,
      "hourly_rate": 500,
      "guaranteed_amount": 4250,
      "topup_amount": 0
    } | null,
    "items": [
      {
        "id": "uuid",
        "client_name": "Иван Иванов",
        "service_name": "Стрижка",
        "service_amount": 1000,
        "consumables_amount": 100,
        "booking_id": "uuid" | null,
        "created_at": "2024-01-26T10:00:00+06:00"
      }
    ],
    "bookings": [
      {
        "id": "uuid",
        "client_name": "Петр Петров",
        "client_phone": "+996555123456",
        "start_at": "2024-01-26T14:00:00+06:00",
        "services": {
          "name_ru": "Окрашивание"
        }
      }
    ],
    "services": [
      {
        "name_ru": "Стрижка",
        "name_ky": "Кесим",
        "name_en": "Haircut"
      }
    ],
    "staffPercentMaster": 60,
    "staffPercentSalon": 40,
    "hourlyRate": 500,
    "currentHoursWorked": 8.5,
    "currentGuaranteedAmount": 4250,
    "isDayOff": false,
    "allShifts": [
      {
        "shift_date": "2024-01-25",
        "status": "closed",
        "total_amount": 8000,
        "master_share": 4800,
        "salon_share": 3200
      }
    ]
  }
}
```

**Ошибки:**
- `400` - Неверный формат даты
- `401` - Не авторизован
- `403` - Нет доступа к данным сотрудника
- `500` - Ошибка получения данных

**Особенности:**
- Использует единый доменный слой `financeDomain` для расчетов
- Поддерживает как сотрудников, так и менеджеров
- Автоматически определяет контекст (сотрудник или менеджер) по наличию `staffId` в query параметрах

---

### POST `/api/staff/shift/close`

Закрытие смены сотрудника с расчетом всех финансовых показателей.

**Rate Limiting:** `critical` (30 req/min)

**Параметры запроса:**
```json
{
  "items": [
    {
      "id": "uuid" | null, // null для новых клиентов
      "clientName": "Иван Иванов",
      "serviceName": "Стрижка",
      "serviceAmount": 1000,
      "consumablesAmount": 100,
      "bookingId": "uuid" | null
    }
  ],
  "totalAmount": 10000, // опционально, если items пустой
  "consumablesAmount": 500, // опционально
  "hoursWorked": 8.5 // опционально, для ручной корректировки
}
```

**Ответ:**
```json
{
  "ok": true,
  "shift": {
    "id": "uuid",
    "shift_date": "2024-01-26",
    "status": "closed",
    "total_amount": 10000,
    "consumables_amount": 500,
    "master_share": 6000,
    "salon_share": 4500,
    "hours_worked": 8.5,
    "hourly_rate": 500,
    "guaranteed_amount": 4250,
    "topup_amount": 0,
    "closed_at": "2024-01-26T18:00:00+06:00"
  }
}
```

**Ошибки:**
- `400` - Смена не найдена, ошибка валидации данных
- `403` - Нет доступа
- `500` - Ошибка расчета или сохранения

**Особенности:**
- Автоматически рассчитывает все финансовые показатели через `financeDomain`
- Обновляет статус связанных бронирований на `paid`
- Отправляет email уведомления сотруднику и владельцу бизнеса
- Использует транзакции для обеспечения целостности данных

---

### POST `/api/staff/shift/items`

Сохранение списка клиентов для открытой смены.

**Rate Limiting:** `normal` (60 req/min)

**Параметры запроса:**
```json
{
  "items": [
    {
      "id": "uuid" | null, // null для новых клиентов
      "clientName": "Иван Иванов",
      "serviceName": "Стрижка",
      "serviceAmount": 1000,
      "consumablesAmount": 100,
      "bookingId": "uuid" | null
    }
  ]
}
```

**Валидация:**
- `clientName`: обязательное, максимум 255 символов
- `serviceName`: обязательное, максимум 255 символов
- `serviceAmount`: обязательное, число >= 0, максимум 1000000
- `consumablesAmount`: опциональное, число >= 0, максимум 1000000

**Ответ:**
```json
{
  "ok": true,
  "shift": {
    "id": "uuid",
    "total_amount": 10000,
    "consumables_amount": 500,
    "master_share": 6000,
    "salon_share": 4500
  }
}
```

**Ошибки:**
- `400` - Смена не открыта, ошибка валидации
- `403` - Нет доступа
- `500` - Ошибка сохранения

**Особенности:**
- Автоматически пересчитывает доли смены при сохранении
- Поддерживает как создание новых клиентов, так и обновление существующих
- Использует единый доменный слой `financeDomain` для расчетов

---

### GET `/api/staff/shift/today`

Получение информации о текущей смене.

**Ответ:**
```json
{
  "shift": {
    "id": "uuid",
    "date": "2024-01-15",
    "status": "open",
    "items_count": 5
  } | null
}
```

---

### POST `/api/staff/create`

Создание сотрудника.

**Параметры запроса:**
```json
{
  "user_id": "uuid",
  "biz_id": "uuid",
  "branch_id": "uuid",
  "full_name": "string"
}
```

**Ответ:**
```json
{
  "ok": true,
  "staff_id": "uuid"
}
```

---

### POST `/api/staff/[id]/update`

Обновление данных сотрудника.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только менеджеры бизнеса
- Сотрудник должен принадлежать бизнесу менеджера

**Параметры запроса:**
```json
{
  "full_name": "string",
  "email": "string" | null,
  "phone": "string" | null,
  "branch_id": "uuid",
  "is_active": boolean,
  "percent_master": number, // опционально, 0-100
  "percent_salon": number, // опционально, 0-100
  "hourly_rate": number | null // опционально
}
```

**Валидация:**
- `full_name`: обязательное, непустая строка
- `branch_id`: обязательное, UUID филиала
- `percent_master` + `percent_salon` должны равняться 100 (если указаны)
- `hourly_rate`: опционально, число >= 0

**Ответ:**
```json
{
  "ok": true,
  "staff": {
    "id": "uuid",
    "full_name": "string",
    "email": "string" | null,
    "phone": "string" | null,
    "branch_id": "uuid",
    "is_active": boolean,
    "percent_master": 60,
    "percent_salon": 40,
    "hourly_rate": 500 | null
  }
}
```

**Ошибки:**
- `400` - Неверные параметры, ошибка валидации
- `403` - Нет доступа к сотруднику
- `404` - Сотрудник не найден

---

### POST `/api/staff/[id]/delete`

Удаление сотрудника.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только менеджеры бизнеса
- Сотрудник должен принадлежать бизнесу менеджера
- У сотрудника не должно быть будущих активных бронирований

**Ответ:**
```json
{
  "ok": true,
  "deleted": true
}
```

**Ошибки:**
- `403` - Нет доступа
- `404` - Сотрудник не найден
- `409` - У сотрудника есть будущие активные бронирования

**Особенности:**
- Удаляет все прошедшие бронирования сотрудника
- Удаляет все смены сотрудника
- Удаляет связи с услугами
- Удаляет роль staff из user_roles

---

### POST `/api/staff/[id]/restore`

Восстановление уволенного сотрудника.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только менеджеры бизнеса
- Сотрудник должен принадлежать бизнесу менеджера

**Ответ:**
```json
{
  "ok": true,
  "staff": {
    "id": "uuid",
    "is_active": true
  }
}
```

**Ошибки:**
- `403` - Нет доступа
- `404` - Сотрудник не найден

---

### POST `/api/staff/[id]/dismiss`

Увольнение сотрудника.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только менеджеры бизнеса
- Сотрудник должен принадлежать бизнесу менеджера

**Ответ:**
```json
{
  "ok": true,
  "staff": {
    "id": "uuid",
    "is_active": false
  }
}
```

**Ошибки:**
- `403` - Нет доступа
- `404` - Сотрудник не найден

---

### POST `/api/staff/[id]/transfer`

Перевод сотрудника в другой филиал.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только менеджеры бизнеса
- Сотрудник и целевой филиал должны принадлежать бизнесу менеджера

**Параметры запроса:**
```json
{
  "target_branch_id": "uuid"
}
```

**Ответ:**
```json
{
  "ok": true,
  "staff": {
    "id": "uuid",
    "branch_id": "uuid"
  }
}
```

**Ошибки:**
- `400` - Неверные параметры
- `403` - Нет доступа
- `404` - Сотрудник или филиал не найден

---

### POST `/api/staff/create-from-user`

Создание сотрудника из существующего пользователя.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только менеджеры бизнеса

**Параметры запроса:**
```json
{
  "user_id": "uuid",
  "branch_id": "uuid",
  "full_name": "string"
}
```

**Ответ:**
```json
{
  "ok": true,
  "staff_id": "uuid"
}
```

**Ошибки:**
- `400` - Неверные параметры, пользователь уже является сотрудником
- `403` - Нет доступа

---

### POST `/api/staff/update`

**⚠️ Deprecated:** Используйте `/api/staff/[id]/update` вместо этого endpoint.

Обновление данных сотрудника (старый endpoint).

**Параметры запроса:**
```json
{
  "full_name": "string",
  "branch_id": "uuid" // опционально
}
```

---

### POST `/api/staff/avatar/upload`

Загрузка аватара сотрудника.

**Параметры запроса:**
- `multipart/form-data`
- `file`: файл изображения

**Ответ:**
```json
{
  "ok": true,
  "avatar_url": "https://..."
}
```

---

### POST `/api/staff/avatar/remove`

Удаление аватара сотрудника.

**Ответ:**
```json
{
  "ok": true
}
```

---

## Филиалы

### POST `/api/branches/create`

Создание нового филиала.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только супер-администратор

**Параметры запроса:**
```json
{
  "name": "string",
  "address": "string" | null,
  "is_active": boolean, // опционально, по умолчанию true
  "lat": number | null, // опционально
  "lon": number | null // опционально
}
```

**Валидация:**
- `name`: обязательное, непустая строка
- `lat`/`lon`: если указаны, должны быть валидными координатами (-90 до 90 для lat, -180 до 180 для lon)

**Ответ:**
```json
{
  "ok": true,
  "branch": {
    "id": "uuid",
    "name": "string",
    "address": "string" | null,
    "is_active": true,
    "biz_id": "uuid"
  }
}
```

**Ошибки:**
- `400` - Неверные параметры, некорректные координаты
- `403` - Нет доступа (только супер-администратор)

---

### POST `/api/branches/[id]/delete`

Удаление филиала.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только менеджеры бизнеса
- Филиал должен принадлежать бизнесу менеджера

**Ответ:**
```json
{
  "ok": true,
  "deleted": true
}
```

**Ошибки:**
- `403` - Нет доступа
- `404` - Филиал не найден

---

### POST `/api/branches/[id]/schedule`

Сохранение расписания работы филиала.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только менеджеры бизнеса
- Филиал должен принадлежать бизнесу менеджера

**Параметры запроса:**
```json
{
  "schedule": [
    {
      "day_of_week": 1, // 0 = воскресенье, 1 = понедельник, ..., 6 = суббота
      "intervals": [
        {
          "start": "09:00",
          "end": "18:00"
        }
      ],
      "breaks": [ // опционально
        {
          "start": "13:00",
          "end": "14:00"
        }
      ]
    }
  ]
}
```

**Ответ:**
```json
{
  "ok": true
}
```

**Ошибки:**
- `400` - Неверные параметры, ошибка валидации
- `403` - Нет доступа
- `404` - Филиал не найден

---

### GET `/api/branches/[id]/schedule`

Получение расписания работы филиала.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только менеджеры бизнеса
- Филиал должен принадлежать бизнесу менеджера

**Ответ:**
```json
{
  "ok": true,
  "schedule": [
    {
      "day_of_week": 1,
      "intervals": [
        {
          "start": "09:00",
          "end": "18:00"
        }
      ],
      "breaks": [
        {
          "start": "13:00",
          "end": "14:00"
        }
      ]
    }
  ]
}
```

**Ошибки:**
- `403` - Нет доступа
- `404` - Филиал не найден

---

## Услуги

### POST `/api/services/create`

Создание новой услуги.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только менеджеры бизнеса

**Параметры запроса:**
```json
{
  "name_ru": "string",
  "name_ky": "string" | null, // опционально
  "name_en": "string" | null, // опционально
  "duration_min": number,
  "price_from": number,
  "price_to": number,
  "active": boolean, // опционально, по умолчанию true
  "branch_ids": ["uuid"], // массив ID филиалов
  "branch_id": "uuid" | null // опционально, для обратной совместимости
}
```

**Валидация:**
- `name_ru`: обязательное, непустая строка
- `duration_min`: обязательное, число > 0
- `price_from`: обязательное, число >= 0
- `price_to`: обязательное, число >= price_from
- `branch_ids`: обязательное, непустой массив UUID

**Ответ:**
```json
{
  "ok": true,
  "service": {
    "id": "uuid",
    "name_ru": "string",
    "duration_min": 60,
    "price_from": 1000,
    "price_to": 2000,
    "active": true
  }
}
```

**Ошибки:**
- `400` - Неверные параметры, ошибка валидации
- `403` - Нет доступа

---

### POST `/api/services/[id]/update`

Обновление услуги.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только менеджеры бизнеса
- Услуга должна принадлежать бизнесу менеджера

**Параметры запроса:**
```json
{
  "name_ru": "string", // опционально
  "name_ky": "string" | null, // опционально
  "name_en": "string" | null, // опционально
  "duration_min": number, // опционально
  "price_from": number, // опционально
  "price_to": number, // опционально
  "active": boolean, // опционально
  "branch_ids": ["uuid"] // опционально, массив ID филиалов
}
```

**Ответ:**
```json
{
  "ok": true,
  "service": {
    "id": "uuid",
    "name_ru": "string",
    "duration_min": 60,
    "price_from": 1000,
    "price_to": 2000,
    "active": true
  }
}
```

**Ошибки:**
- `400` - Неверные параметры, ошибка валидации
- `403` - Нет доступа
- `404` - Услуга не найдена

---

### POST `/api/services/[id]/delete`

Удаление услуги.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только менеджеры бизнеса
- Услуга должна принадлежать бизнесу менеджера

**Ответ:**
```json
{
  "ok": true,
  "deleted": true
}
```

**Ошибки:**
- `403` - Нет доступа
- `404` - Услуга не найдена

---

## Отзывы

### POST `/api/reviews/create`

Создание отзыва на бронирование.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только авторизованные пользователи
- Бронирование должно принадлежать текущему пользователю
- Отзыв еще не должен существовать

**Параметры запроса:**
```json
{
  "booking_id": "uuid",
  "rating": number, // 1-5
  "comment": "string" // опционально
}
```

**Валидация:**
- `booking_id`: обязательное, UUID
- `rating`: обязательное, число от 1 до 5
- `comment`: опционально, строка

**Ответ:**
```json
{
  "ok": true,
  "review": {
    "id": "uuid",
    "booking_id": "uuid",
    "rating": 5,
    "comment": "string" | null,
    "created_at": "2024-01-15T10:00:00+06:00"
  }
}
```

**Ошибки:**
- `400` - Неверные параметры, отзыв уже существует
- `401` - Не авторизован
- `403` - Бронирование не принадлежит пользователю
- `404` - Бронирование не найдено

---

### POST `/api/reviews/update`

Обновление отзыва.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только авторизованные пользователи
- Отзыв должен принадлежать текущему пользователю

**Параметры запроса:**
```json
{
  "rating": number, // опционально, 1-5
  "comment": "string" // опционально
}
```

**Ответ:**
```json
{
  "ok": true,
  "review": {
    "id": "uuid",
    "rating": 5,
    "comment": "string" | null
  }
}
```

**Ошибки:**
- `400` - Неверные параметры
- `401` - Не авторизован
- `403` - Отзыв не принадлежит пользователю
- `404` - Отзыв не найден

---

## Филиалы

### POST `/api/branches/create`

Создание нового филиала.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только супер-администратор

**Параметры запроса:**
```json
{
  "name": "string",
  "address": "string" | null,
  "is_active": boolean, // опционально, по умолчанию true
  "lat": number | null, // опционально
  "lon": number | null // опционально
}
```

**Валидация:**
- `name`: обязательное, непустая строка
- `lat`/`lon`: если указаны, должны быть валидными координатами (-90 до 90 для lat, -180 до 180 для lon)

**Ответ:**
```json
{
  "ok": true,
  "branch": {
    "id": "uuid",
    "name": "string",
    "address": "string" | null,
    "is_active": true,
    "biz_id": "uuid"
  }
}
```

**Ошибки:**
- `400` - Неверные параметры, некорректные координаты
- `403` - Нет доступа (только супер-администратор)

---

### POST `/api/branches/[id]/delete`

Удаление филиала.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только менеджеры бизнеса
- Филиал должен принадлежать бизнесу менеджера

**Ответ:**
```json
{
  "ok": true,
  "deleted": true
}
```

**Ошибки:**
- `403` - Нет доступа
- `404` - Филиал не найден

---

### POST `/api/branches/[id]/schedule`

Сохранение расписания работы филиала.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только менеджеры бизнеса
- Филиал должен принадлежать бизнесу менеджера

**Параметры запроса:**
```json
{
  "schedule": [
    {
      "day_of_week": 1, // 0 = воскресенье, 1 = понедельник, ..., 6 = суббота
      "intervals": [
        {
          "start": "09:00",
          "end": "18:00"
        }
      ],
      "breaks": [ // опционально
        {
          "start": "13:00",
          "end": "14:00"
        }
      ]
    }
  ]
}
```

**Ответ:**
```json
{
  "ok": true
}
```

**Ошибки:**
- `400` - Неверные параметры, ошибка валидации
- `403` - Нет доступа
- `404` - Филиал не найден

---

### GET `/api/branches/[id]/schedule`

Получение расписания работы филиала.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только менеджеры бизнеса
- Филиал должен принадлежать бизнесу менеджера

**Ответ:**
```json
{
  "ok": true,
  "schedule": [
    {
      "day_of_week": 1,
      "intervals": [
        {
          "start": "09:00",
          "end": "18:00"
        }
      ],
      "breaks": [
        {
          "start": "13:00",
          "end": "14:00"
        }
      ]
    }
  ]
}
```

**Ошибки:**
- `403` - Нет доступа
- `404` - Филиал не найден

---

## Услуги

### POST `/api/services/create`

Создание новой услуги.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только менеджеры бизнеса

**Параметры запроса:**
```json
{
  "name_ru": "string",
  "name_ky": "string" | null, // опционально
  "name_en": "string" | null, // опционально
  "duration_min": number,
  "price_from": number,
  "price_to": number,
  "active": boolean, // опционально, по умолчанию true
  "branch_ids": ["uuid"], // массив ID филиалов
  "branch_id": "uuid" | null // опционально, для обратной совместимости
}
```

**Валидация:**
- `name_ru`: обязательное, непустая строка
- `duration_min`: обязательное, число > 0
- `price_from`: обязательное, число >= 0
- `price_to`: обязательное, число >= price_from
- `branch_ids`: обязательное, непустой массив UUID

**Ответ:**
```json
{
  "ok": true,
  "service": {
    "id": "uuid",
    "name_ru": "string",
    "duration_min": 60,
    "price_from": 1000,
    "price_to": 2000,
    "active": true
  }
}
```

**Ошибки:**
- `400` - Неверные параметры, ошибка валидации
- `403` - Нет доступа

---

### POST `/api/services/[id]/update`

Обновление услуги.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только менеджеры бизнеса
- Услуга должна принадлежать бизнесу менеджера

**Параметры запроса:**
```json
{
  "name_ru": "string", // опционально
  "name_ky": "string" | null, // опционально
  "name_en": "string" | null, // опционально
  "duration_min": number, // опционально
  "price_from": number, // опционально
  "price_to": number, // опционально
  "active": boolean, // опционально
  "branch_ids": ["uuid"] // опционально, массив ID филиалов
}
```

**Ответ:**
```json
{
  "ok": true,
  "service": {
    "id": "uuid",
    "name_ru": "string",
    "duration_min": 60,
    "price_from": 1000,
    "price_to": 2000,
    "active": true
  }
}
```

**Ошибки:**
- `400` - Неверные параметры, ошибка валидации
- `403` - Нет доступа
- `404` - Услуга не найдена

---

### POST `/api/services/[id]/delete`

Удаление услуги.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только менеджеры бизнеса
- Услуга должна принадлежать бизнесу менеджера

**Ответ:**
```json
{
  "ok": true,
  "deleted": true
}
```

**Ошибки:**
- `403` - Нет доступа
- `404` - Услуга не найдена

---

## Дашборд

### GET `/api/dashboard/finance/all`

Получение финансовой статистики для всех сотрудников.

**Query параметры:**
- `period`: `day` | `week` | `month` | `year` (по умолчанию `month`)
- `start_date`: `YYYY-MM-DD` (опционально)
- `end_date`: `YYYY-MM-DD` (опционально)
- `branch_id`: `uuid` (опционально, фильтр по филиалу)

**Требования:**
- Только менеджеры бизнеса

**Ответ:**
```json
{
  "stats": [
    {
      "staff_id": "uuid",
      "staff_name": "string",
      "total_amount": 50000,
      "master_share": 30000,
      "salon_share": 20000,
      "hours_worked": 160,
      "shifts_count": 20
    }
  ],
  "period": {
    "start": "2024-01-01",
    "end": "2024-01-31"
  }
}
```

---

### GET `/api/dashboard/staff/[id]/finance`

Получение финансовой статистики конкретного сотрудника.

**Query параметры:**
- `period`: `day` | `week` | `month` | `year`
- `start_date`: `YYYY-MM-DD`
- `end_date`: `YYYY-MM-DD`

**Ответ:**
```json
{
  "staff_id": "uuid",
  "staff_name": "string",
  "total_amount": 50000,
  "master_share": 30000,
  "salon_share": 20000,
  "hours_worked": 160,
  "shifts_count": 20,
  "shifts": [
    {
      "id": "uuid",
      "date": "2024-01-15",
      "total_amount": 5000,
      "master_share": 3000,
      "salon_share": 2000
    }
  ]
}
```

---

### GET `/api/dashboard/staff/finance/all`

Получение финансовой статистики всех сотрудников (агрегированная версия).

**Ответ:**
```json
{
  "stats": [
    {
      "staff_id": "uuid",
      "staff_name": "string",
      "total_amount": 50000,
      "master_share": 30000,
      "salon_share": 20000
    }
  ]
}
```

---

### GET `/api/dashboard/staff/[id]/finance/stats`

Получение статистики по сотруднику (краткая версия).

**Ответ:**
```json
{
  "total_amount": 50000,
  "master_share": 30000,
  "salon_share": 20000,
  "hours_worked": 160
}
```

---

### POST `/api/dashboard/branches/[branchId]/promotions`

Создание промоакции для филиала.

**Параметры запроса:**
```json
{
  "promotion_type": "free_after_n_visits" | "referral_free" | "referral_discount_50" | "birthday_discount" | "first_visit_discount",
  "title_ru": "string",
  "params": {
    // Зависит от типа промоакции
    "n_visits": 5, // для free_after_n_visits
    "discount_percent": 50 // для discount типов
  }
}
```

**Ответ:**
```json
{
  "ok": true,
  "promotion_id": "uuid"
}
```

---

### GET `/api/dashboard/branches/[branchId]/promotions`

Получение списка промоакций филиала.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только менеджеры бизнеса
- Филиал должен принадлежать бизнесу менеджера

**Ответ:**
```json
{
  "ok": true,
  "promotions": [
    {
      "id": "uuid",
      "promotion_type": "string",
      "title_ru": "string",
      "params": {},
      "is_active": true,
      "usage_count": 5 // количество использований
    }
  ]
}
```

**Ошибки:**
- `403` - Нет доступа
- `404` - Филиал не найден

---

### PATCH `/api/dashboard/branches/[branchId]/promotions/[promotionId]`

Обновление промоакции филиала.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только менеджеры бизнеса
- Промоакция должна принадлежать филиалу бизнеса менеджера

**Параметры запроса:**
```json
{
  "promotion_type": "free_after_n_visits" | "referral_free" | "referral_discount_50" | "birthday_discount" | "first_visit_discount", // опционально
  "title_ru": "string", // опционально
  "title_ky": "string" | null, // опционально
  "title_en": "string" | null, // опционально
  "description_ru": "string" | null, // опционально
  "description_ky": "string" | null, // опционально
  "description_en": "string" | null, // опционально
  "params": {}, // опционально, зависит от типа промоакции
  "is_active": boolean, // опционально
  "valid_from": "YYYY-MM-DD" | null, // опционально
  "valid_to": "YYYY-MM-DD" | null // опционально
}
```

**Ответ:**
```json
{
  "ok": true,
  "promotion": {
    "id": "uuid",
    "promotion_type": "string",
    "title_ru": "string",
    "params": {},
    "is_active": true
  }
}
```

**Ошибки:**
- `400` - Неверные параметры, ошибка валидации
- `403` - Нет доступа
- `404` - Промоакция не найдена

---

### DELETE `/api/dashboard/branches/[branchId]/promotions/[promotionId]`

Удаление промоакции.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только менеджеры бизнеса
- Промоакция должна принадлежать филиалу бизнеса менеджера

**Ответ:**
```json
{
  "ok": true
}
```

**Ошибки:**
- `403` - Нет доступа
- `404` - Промоакция не найдена

---

### POST `/api/dashboard/staff/[id]/shift/open`

Открытие смены для сотрудника (для менеджера/владельца).

**Rate Limiting:** `critical` (30 req/min)

**Требования:**
- Только менеджеры бизнеса
- Сотрудник должен принадлежать бизнесу менеджера

**Query параметры:**
- `date` (опционально) - дата в формате `YYYY-MM-DD` (по умолчанию сегодня)

**Ответ:**
```json
{
  "ok": true,
  "shift": {
    "id": "uuid",
    "shift_date": "2024-01-15",
    "status": "open",
    "opened_at": "2024-01-15T09:00:00+06:00"
  }
}
```

**Ошибки:**
- `400` - Выходной день, смена уже открыта
- `403` - Нет доступа
- `404` - Сотрудник не найден

---

### POST `/api/dashboard/staff-shifts/[id]/update-hours`

Ручная корректировка отработанных часов для закрытой смены.

**Rate Limiting:** `normal` (60 req/min)

**Требования:**
- Только владельцы бизнеса
- Смена должна принадлежать бизнесу владельца

**Параметры запроса:**
```json
{
  "hours_worked": 8.5
}
```

**Валидация:**
- `hours_worked`: обязательное, число >= 0, максимум 24

**Ответ:**
```json
{
  "ok": true,
  "shift": {
    "id": "uuid",
    "hours_worked": 8.5,
    "guaranteed_amount": 4250, // пересчитывается автоматически
    "topup_amount": 0 // пересчитывается автоматически
  }
}
```

**Ошибки:**
- `400` - Неверные параметры, смена не закрыта
- `403` - Нет доступа
- `404` - Смена не найдена

**Особенности:**
- Автоматически пересчитывает гарантированную сумму и доплату
- Использует единый доменный слой `financeDomain` для расчетов

---

## Администрирование

### GET `/api/admin/health-check`

Проверка здоровья системы.

**Ответ:**
```json
{
  "ok": true,
  "timestamp": "2024-01-15T10:00:00Z",
  "services": {
    "database": "ok",
    "storage": "ok"
  }
}
```

---

### GET `/api/admin/performance/stats`

Получение статистики производительности (только для super-admin).

**Ответ:**
```json
{
  "stats": [
    {
      "name": "get_free_slots_service_day_v2",
      "type": "rpc",
      "avg": 150,
      "min": 50,
      "max": 500,
      "p95": 300,
      "p99": 450,
      "errorRate": 0.01,
      "status": "ok"
    }
  ]
}
```

---

### POST `/api/admin/ratings/status`

Получение статуса расчета рейтингов.

**Ответ:**
```json
{
  "last_calculation": "2024-01-15T10:00:00Z",
  "status": "ok"
}
```

---

### POST `/api/admin/initialize-ratings`

Инициализация расчета рейтингов.

**Ответ:**
```json
{
  "ok": true,
  "message": "Ratings initialization started"
}
```

---

### GET `/api/admin/promotions/debug`

Отладка промоакций (только для super-admin).

**Query параметры:**
- `client_id`: `uuid`
- `booking_id`: `uuid`
- `branch_id`: `uuid`

**Ответ:**
```json
{
  "client": {
    "id": "uuid",
    "visits_count": 5,
    "referrals_count": 2
  },
  "applicable_promotions": [
    {
      "id": "uuid",
      "type": "free_after_n_visits",
      "title_ru": "Бесплатно после 5 визитов"
    }
  ],
  "applied_promotion": {
    "id": "uuid",
    "type": "free_after_n_visits"
  }
}
```

---

## Cron Jobs

### POST `/api/cron/close-shifts`

Автоматическое закрытие смен (вызывается по расписанию).

**Авторизация:**
- Требуется секретный ключ в заголовке `X-Cron-Secret`

**Ответ:**
```json
{
  "ok": true,
  "closed_shifts": 5,
  "errors": []
}
```

---

### POST `/api/cron/recalculate-ratings`

Пересчет рейтингов (вызывается по расписанию).

**Авторизация:**
- Требуется секретный ключ в заголовке `X-Cron-Secret`

**Параметры запроса:**
```json
{
  "date": "2024-01-15" // опционально, по умолчанию вчерашний день
}
```

**Ответ:**
```json
{
  "ok": true,
  "recalculated": 100
}
```

---

### POST `/api/cron/health-check-alerts`

Проверка здоровья системы и отправка алертов (вызывается по расписанию).

**Авторизация:**
- Требуется секретный ключ в заголовке `X-Cron-Secret`

**Ответ:**
```json
{
  "ok": true,
  "alerts_sent": 0
}
```

---

## Webhooks

### POST `/api/webhooks/whatsapp`

Webhook для получения сообщений от WhatsApp.

**Параметры запроса:**
```json
{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "messages": [
              {
                "from": "string",
                "text": {
                  "body": "string"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

**Ответ:**
```json
{
  "ok": true
}
```

---

## Профиль

### POST `/api/profile/update`

Обновление профиля пользователя.

**Параметры запроса:**
```json
{
  "full_name": "string",
  "phone": "string",
  "email": "string"
}
```

**Ответ:**
```json
{
  "ok": true,
  "user": {
    "id": "uuid",
    "full_name": "string",
    "phone": "string",
    "email": "string"
  }
}
```

---

### POST `/api/user/update-phone`

Обновление телефона пользователя.

**Параметры запроса:**
```json
{
  "phone": "string"
}
```

**Ответ:**
```json
{
  "ok": true
}
```

---

## Уведомления

### POST `/api/notify`

Отправка уведомления о бронировании.

**Параметры запроса:**
```json
{
  "type": "hold" | "confirm" | "cancel",
  "booking_id": "uuid"
}
```

**Ответ:**
```json
{
  "ok": true
}
```

---

### GET `/api/notify/ping`

Проверка доступности сервиса уведомлений.

**Ответ:**
```json
{
  "ok": true,
  "message": "pong"
}
```

---

## WhatsApp

### POST `/api/whatsapp/send-otp`

Отправка OTP кода через WhatsApp.

**Rate Limiting:** `auth` (5 req/15min)

**Параметры запроса:**
```json
{
  "phone": "string"
}
```

**Ответ:**
```json
{
  "ok": true,
  "message_id": "string"
}
```

---

### POST `/api/whatsapp/verify-otp`

Проверка OTP кода.

**Rate Limiting:** `auth` (10 req/15min)

**Параметры запроса:**
```json
{
  "phone": "string",
  "code": "string"
}
```

**Ответ:**
```json
{
  "ok": true,
  "session": {
    "access_token": "string",
    "refresh_token": "string"
  }
}
```

---

## Rate Limiting

Все endpoints защищены rate limiting с различными конфигурациями:

- **`public`**: 100 запросов за 15 минут (публичные endpoints)
- **`normal`**: 60 запросов в минуту (обычные операции)
- **`critical`**: 30 запросов в минуту (критичные операции: открытие/закрытие смен)
- **`auth`**: 5-10 запросов за 15 минут (операции аутентификации)

При превышении лимита возвращается статус `429 Too Many Requests` с заголовками:
- `X-RateLimit-Limit`: максимальное количество запросов
- `X-RateLimit-Remaining`: оставшееся количество запросов
- `X-RateLimit-Reset`: время сброса лимита (Unix timestamp)

---

## Ошибки

Все ошибки возвращаются в формате:

```json
{
  "ok": false,
  "error": "error_code",
  "message": "Human readable error message",
  "details": {} // опционально, дополнительные детали
}
```

### Коды ошибок:

- `400` - Bad Request (неверные параметры)
- `401` - Unauthorized (не авторизован)
- `403` - Forbidden (нет доступа)
- `404` - Not Found (ресурс не найден)
- `429` - Too Many Requests (превышен лимит)
- `500` - Internal Server Error (ошибка сервера)

---

## Авторизация

Большинство endpoints требуют авторизации. Используется два метода:

1. **Bearer Token** (для мобильного приложения):
   ```
   Authorization: Bearer <access_token>
   ```

2. **Cookies** (для веб-версии):
   - Токены хранятся в HTTP-only cookies
   - Автоматически отправляются браузером

---

## Временные зоны

Все даты и время обрабатываются в таймзоне `Asia/Bishkek` (UTC+6).

Формат даты: `YYYY-MM-DD`
Формат времени: ISO 8601 с таймзоной, например: `2024-01-15T10:00:00+06:00`

---

## Версионирование

Текущая версия API: `v1` (неявная)

В будущем может быть добавлено версионирование через префикс пути: `/api/v1/...`

---

## Примеры использования

### Создание бронирования (мобильное приложение)

```bash
curl -X POST https://kezek.kg/api/quick-hold \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "biz_id": "123e4567-e89b-12d3-a456-426614174000",
    "branch_id": "123e4567-e89b-12d3-a456-426614174001",
    "service_id": "123e4567-e89b-12d3-a456-426614174002",
    "staff_id": "123e4567-e89b-12d3-a456-426614174003",
    "start_at": "2024-01-15T10:00:00+06:00"
  }'
```

### Открытие смены

```bash
curl -X POST https://kezek.kg/api/staff/shift/open \
  -H "Cookie: <session_cookie>" \
  -H "Content-Type: application/json"
```

### Получение финансовой статистики

```bash
curl -X GET "https://kezek.kg/api/dashboard/finance/all?period=month&branch_id=123e4567-e89b-12d3-a456-426614174001" \
  -H "Cookie: <session_cookie>"
```

---

## Примечания

- Все UUID должны быть в формате стандартного UUID v4
- Все суммы указываются в сомах (KGS)
- Все временные интервалы указываются в минутах
- Процентные значения указываются как числа (например, 50 для 50%)

---

*Последнее обновление: 2025-01-27*

