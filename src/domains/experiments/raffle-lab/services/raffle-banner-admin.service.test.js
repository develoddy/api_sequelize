import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

import { RaffleDraw } from '../models/raffle-draw.model.js';
import { removeAdminRaffleBanner } from './raffle-banner-admin.service.js';

function createMockDraw({
    desktop = '/uploads/desktop.webp',
    mobile = '/uploads/mobile.webp',
} = {}) {
    const updates = [];

    const draw = {
        id: 999999,
        banner_image: desktop,
        banner_image_mobile: mobile,

        async update(values) {
            updates.push(values);
            Object.assign(this, values);
            return this;
        },
    };

    return { draw, updates };
}

test('retirar mobile conserva desktop', async () => {
    const { draw, updates } = createMockDraw();
    const originalDesktop = draw.banner_image;

    const findMock = mock.method(
        RaffleDraw,
        'findByPk',
        async () => draw
    );

    try {
        const result = await removeAdminRaffleBanner({
            drawId: 999999,
            variant: 'mobile',
        });

        assert.equal(result.banner_image_mobile, null);
        assert.equal(result.banner_image, originalDesktop);
        assert.deepEqual(updates, [
            { banner_image_mobile: null },
        ]);
    } finally {
        findMock.mock.restore();
    }
});

test('retirar desktop conserva mobile', async () => {
    const { draw, updates } = createMockDraw();
    const originalMobile = draw.banner_image_mobile;

    const findMock = mock.method(
        RaffleDraw,
        'findByPk',
        async () => draw
    );

    try {
        const result = await removeAdminRaffleBanner({
            drawId: 999999,
            variant: 'desktop',
        });

        assert.equal(result.banner_image, null);
        assert.equal(result.banner_image_mobile, originalMobile);
        assert.deepEqual(updates, [
            { banner_image: null },
        ]);
    } finally {
        findMock.mock.restore();
    }
});

test('rechaza variantes inválidas', async () => {
    await assert.rejects(
        removeAdminRaffleBanner({
            drawId: 999999,
            variant: 'tablet',
        }),
        /Variante de banner inválida/
    );
});

test('rechaza sorteos inexistentes', async () => {
    const findMock = mock.method(
        RaffleDraw,
        'findByPk',
        async () => null
    );

    try {
        await assert.rejects(
            removeAdminRaffleBanner({
                drawId: 999999,
                variant: 'mobile',
            }),
            /Sorteo no encontrado/
        );
    } finally {
        findMock.mock.restore();
    }
});

test('banner ya retirado no genera actualización', async () => {
    const { draw, updates } = createMockDraw({
        mobile: null,
    });

    const findMock = mock.method(
        RaffleDraw,
        'findByPk',
        async () => draw
    );

    try {
        const result = await removeAdminRaffleBanner({
            drawId: 999999,
            variant: 'mobile',
        });

        assert.equal(result.banner_image_mobile, null);
        assert.equal(updates.length, 0);
    } finally {
        findMock.mock.restore();
    }
});
